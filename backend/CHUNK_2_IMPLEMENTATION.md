# Chunk 2 — concurrency and storage protections

Implemented in the NestJS backend. No schema migration was added. Source changes have not been deployed.

| Audit ID | Change |
|---|---|
| NV-09 | Customer TFN selection and sub-billing tenant provisioning now use `updateMany` with `id`, `tenantId: null`, and `status: AVAILABLE`. Exactly one updated row wins. TFN FreeSWITCH, Redis, and sub-billing sync for provisioning runs after the transaction commits and only for the winner. |
| NV-11 | Recording check and playback accept the authenticated tenant's customer code and a canonical UUID. Storage resolves the path beneath that tenant's directory, checks the real file path and regular-file type, and opens playback without following a final symlink. Invalid/missing paths return a negative check or 404. |
| NV-12 | Nested ring-group creation checks that every extension belongs to the tenant. Member update/reorder checks the parent group and each member; API responses select only public extension fields. Dialplan sync refuses an existing group with a foreign extension and removes that group's unsafe dialplan key. |
| NV-14 | DID and TFN routing updates, including the alternate `POST /telecom/tfns/:id/routing` path, validate the effective route type and destination after merging the submitted fields with stored values. Operational schedules do the same for primary, after-hours, and weekend routes. Writes retain the tenant predicate. |
| NV-07 | IVR root and submenu validation now checks `schedule`, `did_forward`, and `forward` targets against the owner tenant, in addition to existing extension/ring-group/IVR checks. FreeSWITCH dialplan-key resolution also checks target ownership, so a previously persisted foreign ID is not resolved during a resync. |

## Deployment and data review

- The recording route assumes FreeSWITCH files are named `<call UUID>.mp3` under `<FS_RECORDING_PATH>/<customerCode>/`. Check the mounted recording layout and permissions before release. If a legacy recording uses a different filename grammar, migrate or add a separately authorized lookup; do not loosen path containment.
- Existing cross-tenant route IDs or ring-group members in the database should be reviewed in staging and repaired before resync. The new code blocks new writes and rejects invalid targets during resolution. Existing materialized FreeSWITCH/did_routes records need a controlled reconciliation as part of rollout.
- The two TFN claim paths now return an availability error when another request wins. A Redis or external sync failure after a committed claim still needs operational retry/reconciliation; the loser cannot publish a competing owner.
- Routing changes can affect calls. Validate with disposable tenants and local call fixtures before production deployment.

## Verification

The focused regression suite uses dummy TFNs, tenant-owned and foreign route IDs, scratch recording files, and a two-request race fixture:

```text
cd D:\bala_billing\wlabel\pbx-whitelable\backend
npm run test:security:chunk2
npm run build
```

Source review and `git diff --check` were performed. Jest and the build have not been executed in this session. The security-audit skill requires OS-enforced network isolation, an allowlisted environment, read-only target/toolchain access, scratch-only writes, and resource limits for target-code execution; this host session does not provide all those controls. Its rule is: "If every control cannot be enforced, do not execute target code." Run the suite and staging checks in that environment before deployment.
