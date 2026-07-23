# Global Call Monitoring Documentation for Frontend (Rushank)

This document describes the updated APIs and WebSocket events for Call Monitoring. It includes support for `SUPER_ADMIN` to retrieve active calls globally and stream all events across all tenants, while keeping standard tenant isolation intact for normal `ADMIN` users.

---

## 🔑 Super Admin Extension Setup Convention
- Standard tenant supervisor/monitoring extensions are prefixed with their 4-digit tenant customer code (e.g., `100101`, `100102`).
- **Super Admin** monitoring extensions must use a global/system-wide prefix **`999`** followed by a sequence (e.g., `999001`, `999002`). This prevents collision with any tenant extensions.
- When configuring/enabling monitoring for a Super Admin, update their permissions via `PATCH /api/users/:id/permissions` with the monitoring extension starting with `999`.

---

## 🌐 REST API Endpoints

### 1. Retrieve Active Calls
- **Endpoint:** `GET /api/monitor/active-calls`
- **Query Parameter:** `tenantId` (optional)
  - `?tenantId=all` explicitly requests calls across all tenants globally. **Allowed for `SUPER_ADMIN` only.**
  - If a regular `ADMIN` requests `tenantId=all` or a different tenant's ID, the server returns `403 Forbidden`.
  - If no `tenantId` is specified, it defaults to the authenticated user's own `tenantId`.

#### Response Payload (`GET /api/monitor/active-calls?tenantId=all`):
```json
{
  "calls": [
    {
      "uuid": "a8d56ed3-e9d2-46bf-af84-da032912fb2b",
      "bUuid": "1d4bf462-7dd8-4699-b1e7-53ad4646febf",
      "caller": "+14042327573",
      "callee": "8886343114",
      "status": "answered",
      "destType": "extension",
      "destValue": "100201",
      "direction": "inbound",
      "startTime": "2026-07-23T18:05:00.000Z",
      "answerTime": "2026-07-23T18:05:02.000Z",
      "duration": 18,
      "tenantId": "5d09f9b9-4313-4ab7-b86c-28bd05fcdf92"
    }
  ]
}
```

---

### 2. Initiate Barge (Listen, Whisper, Barge)
- **Endpoint:** `POST /api/monitor/barge`
- **Payload Schema:**
  ```json
  {
    "uuid_in": "a8d56ed3-e9d2-46bf-af84-da032912fb2b",
    "uuid_out": "1d4bf462-7dd8-4699-b1e7-53ad4646febf",
    "mode": "listen", // Options: "listen", "whisper", "barge"
    "adminExtension": "999001" // Super Admin's monitoring extension
  }
  ```
- **Tenancy Validation Rules:**
  - For standard `ADMIN` users: The backend verifies that the target call `uuid_in` belongs to the requesting admin's `tenantId`. If not, it throws `403 Forbidden`.
  - For `SUPER_ADMIN` users: Bypasses tenant-ownership checks completely, allowing them to barge calls from any tenant.

---

## 🔌 Socket.IO WebSocket Streaming (Namespace: `/monitor`)

- **Socket URL:** `wss://<host>/api/socket.io/?EIO=4&transport=websocket` under the `monitor` namespace.
- **Security:** Standard JWT verification via connection token.

### 🚪 Joining the Monitoring Room
1. Send `join_room` message with the target `tenantId`.
2. For Super Admin to stream updates globally, join the room named **`all`**:
   - `socket.emit('join_room', 'all')` (Verified on backend for `SUPER_ADMIN` role).
3. The server responds with `room_joined`:
   - Event: `room_joined`
   - Payload: `{"room": "tenant:all"}`

---

### 📈 Incoming WebSocket Events

#### 1. Live Call Updates (`call_update`)
Fires in real-time whenever a call is initiated, rings, is answered, or hangs up.
- **Event Name:** `call_update`
- **Received in Room:** `tenant:all` (global) or `tenant:<tenantId>` (tenant specific)
- **Payload Schema:**
```json
{
  "uuid": "a8d56ed3-e9d2-46bf-af84-da032912fb2b",
  "bUuid": "1d4bf462-7dd8-4699-b1e7-53ad4646febf",
  "caller": "+14042327573",
  "callee": "8886343114",
  "status": "answered", // "new", "ringing", "answered", "hangup"
  "destType": "extension",
  "destValue": "100201",
  "direction": "inbound",
  "startTime": 1764078165, // Unix epoch seconds
  "answerTime": 1764078167,
  "duration": 18,
  "tenantId": "5d09f9b9-4313-4ab7-b86c-28bd05fcdf92"
}
```

#### 2. Analytics Snapshot (`analytics_snapshot`)
Pushed immediately upon joining a room, and then every 30 seconds thereafter.
- **Event Name:** `analytics_snapshot`
- **Received in Room:** `tenant:all` (global metrics) or `tenant:<tenantId>` (tenant-specific metrics)
- **Payload Schema (Global Snapshot for Super Admins):**
```json
{
  "tenantId": "all",
  "activeCalls": 12,   // Total active calls across all tenants
  "ringing": 3,       // Ringing calls globally
  "answered": 9,      // Answered calls globally
  "inbound": 7,       // Inbound calls globally
  "outbound": 5,      // Outbound calls globally
  "timestamp": 1764078195000
}
```
