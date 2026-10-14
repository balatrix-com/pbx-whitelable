# Chunk 1 — API tenant boundaries

Implemented in the NestJS backend only. No database migration is required. The source changes are local and have not been deployed.

| Audit ID | Implemented behavior |
|---|---|
| NV-05 | Tenant invoice detail reads use both invoice ID and authenticated tenant ID, including adjustments. Foreign/missing invoices return 404. Missing tenant context cannot become an unfiltered query. Explicit SUPER_ADMIN detail access remains available. |
| NV-02 | Add-on catalog creation/upsert and deletion require SUPER_ADMIN. Catalog reading retains its existing roles. |
| NV-03 | Tenant subscription add-on reads, cancellation, and auto-renew changes require membership in the authenticated tenant's billing customer subscriptions. Unknown/foreign rows return 404 before mutation. Unavailable or malformed ownership responses fail closed. Explicit SUPER_ADMIN access remains available. |
| NV-04 | Quote and purchase reject another tenant's selector with 403. The chosen tenant flows through the primary request and existing fallback debit. Missing billing-customer mappings fail instead of substituting a PBX tenant UUID. |
| NV-10 | Plan deletion requires SUPER_ADMIN through RolesGuard. |
| NV-15 | Tenant Support cannot override its tenant through extension, DID, TFN, phone-number, or subscription-asset APIs. Platform Support is derived from current database relationships, never JWT claims or request fields. Tenantless ADMIN cannot create/invite platform Support or manage a platform user through null tenant equality. Legacy support-manager links cannot override tenant ownership. |
| NV-06 | Extension sync no longer has @Public. Its existing JWT and roles guards now require SUPER_ADMIN. |

## Support scope

A tenant-associated SUPPORT user remains confined to that tenant, including one created by SUPER_ADMIN. Platform Support must have `tenantId = null` and a `SupportProfile` linked to a currently active, tenantless SUPER_ADMIN. JwtStrategy derives `platformSupport` from this relationship on each authenticated request. A missing profile or revoked/tenant-associated sponsor does not grant platform access. No role enum or schema change is needed.

Only telecom selector routes that previously allowed Support to select tenants opt in to platform Support selection. Platform Support does not gain catalog changes, plan deletion, invoice detail, or billing mutations beyond the existing route roles. A platform selector must name a tenant; it cannot accidentally query all tenants by omitting the predicate.

## Compatibility and deployment checks

- Existing unauthenticated sub-billing callbacks to `POST /api/telecom/extensions/sync-from-billing` will receive 401. Do not restore @Public to accommodate them. This chunk leaves the caller unchanged; an authenticated operator can invoke sync with a SUPER_ADMIN token and the PBX tenant UUID. Review the callback workflow before deployment. The legacy `customerId` alias retains its previous PBX-tenant-ID meaning; it is not a billing customer-code translation.
- Review legitimate platform Support accounts for the database relationship above before release. Existing tenantless Support accounts without that relationship will no longer have cross-tenant API selection.
- Add-on ownership uses existing private `/subscriptions/customer/:customerId` and `/addons/subscription/:subscriptionId` APIs. Cancellation/auto-renew can discover only active add-on rows exposed by those APIs; a missing/inactive row fails closed for tenant callers. This adds read requests proportional to the customer's subscription count. Sub-billing must remain private as specified in the deployment scope. A later sub-billing chunk should enforce ownership in the mutation transaction too.
- The existing local purchase-debit fallback is retained and constrained to the authorized tenant. Transactional purchase/idempotency behavior is a separate follow-up; this chunk does not claim to fix it.
- SIP routing, XML generation, ESL commands, existing extension provisioning internals, firewall rules, and port 3000 binding are unchanged. API authorization affects who may initiate sync; validate that workflow before calling this release risk-free.

## Verification

Added focused regression cases for foreign and own invoices/subscriptions/add-ons, spoofed tenant selectors, missing billing links, failed/malformed ownership responses, role guards, platform Support provenance, tenantless-admin rejection, and the purchase fallback tenant. Existing add-on purchase tests remain in the focused suite.

Run from `D:\bala_billing\wlabel\pbx-whitelable\backend` in the isolated test environment:

```text
npm run test:security:chunk1
npm run build
```

Source review and `git diff --check` were performed. Jest and the build have not been executed here: the security-audit skill requires OS-enforced network isolation, an allowlisted environment, read-only source/toolchain access, scratch-only writes, and explicit resource limits for target-code execution; this host session does not provide all those controls. Its rule is: "If every control cannot be enforced, do not execute target code." Consequently this is implemented source with regression tests pending execution, not a passing-test or deployment claim.

Before release, run the focused suite/build and a staging smoke test with two disposable tenants. Confirm own-tenant reads/purchases still work, foreign selectors produce no data or mutation, privileged catalog/plan operations still work, and the approved extension sync caller authenticates successfully.
