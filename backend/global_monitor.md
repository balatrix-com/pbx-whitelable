# Testing Guide: Local Verification of Global Call Monitoring

Since the frontend for Super Admin global monitoring is not yet built, you can verify the end-to-end flow locally using **MicroSIP**, **Postman** (supporting HTTP & Socket.IO), or a simple **Node.js test script**.

---

## 🛠️ Step 1: SIP Softphone Setup (MicroSIP)
To simulate the monitoring flow, you need two active softphone registrations on your machine or local network:

1. **The Agent Extension (Target):**
   - Register a softphone (MicroSIP instance 1) to your Kamailio/FreeSWITCH server using a standard extension (e.g. `100101` belonging to Tenant A).
2. **The Super Admin Extension (Monitor):**
   - Register a second softphone (MicroSIP instance 2, or running on a different port/device) using the Super Admin's monitoring extension **`999001`** (configured with the credentials from the `User` database).

---

## 📞 Step 2: Simulate an Active Call
1. Dial the tenant's TFN or DID from an external number (or another extension) to reach the Agent extension `100101`.
2. Answer the call on the Agent softphone.
3. This will create a live active call record in Redis, stored as a hash key like:
   `customer:tenant-uuid-123:call:call-uuid-abc`

---

## 🔒 Step 3: Authenticate and Query Active Calls via REST API

### 1. Get the Super Admin JWT Token
Send a request to log in as the Super Admin:
- **Request:** `POST /api/auth/login`
- **Body:**
  ```json
  {
    "email": "superadmin@balatrix.com",
    "password": "your-super-admin-password"
  }
  ```
- **Response:** Note the `accessToken` from the response.

### 2. Query Active Calls Globally
Send a request using Postman or `curl` containing the Super Admin's token in the `Authorization: Bearer <token>` header:
- **Request:** `GET /api/monitor/active-calls?tenantId=all`
- **Headers:**
  - `Authorization: Bearer <SUPER_ADMIN_JWT>`
- **Verification:**
  - Verify that the response returns the active call matching the simulated session.
  - Retrieve the **`uuid`** (A-leg) and **`bUuid`** (B-leg) of the call.
  - Verify that the response includes the correct `tenantId` field.

---

## 🔌 Step 4: Stream Real-Time Events via Socket.IO (WebSockets)
You can use **Postman's WebSocket / Socket.IO connection builder** or a client script to connect:

1. **Configure Postman Connection:**
   - Choose **Socket.IO** as the request type.
   - **URL:** `http://localhost:3000/monitor` (or your local backend IP/port).
   - **Handshake Options:**
     - Add `token` as a Query Parameter: `?token=<SUPER_ADMIN_JWT>`
     - Or add under Auth/Headers as configured.
2. **Connect to Namespace:**
   - Once connected, listen for these events:
     - `call_update`
     - `analytics_snapshot`
3. **Join Global Room:**
   - Send (emit) a message:
     - Event Name: `join_room`
     - Message Body (JSON or String): `"all"`
4. **Verification:**
   - You should immediately receive an `analytics_snapshot` event showing the aggregated counters across all tenants:
     ```json
     {
       "tenantId": "all",
       "activeCalls": 1,
       "ringing": 0,
       "answered": 1,
       "inbound": 1,
       "outbound": 0,
       "timestamp": 1764078195000
     }
     ```
   - Hang up the call or make a new one, and verify that `call_update` events are streamed to your Postman client instantly.

---

## 🔊 Step 5: Test the Barge / Listen Functionality
Now you will trigger the barge action to have FreeSWITCH call your Super Admin monitoring extension and bridge the audio.

1. **Trigger Barge API:**
   - **Request:** `POST /api/monitor/barge`
   - **Headers:**
     - `Authorization: Bearer <SUPER_ADMIN_JWT>`
     - `Content-Type: application/json`
   - **Body:**
     ```json
     {
       "uuid_in": "<UUID_FROM_ACTIVE_CALLS_RESPONSE>",
       "uuid_out": "<B_UUID_FROM_ACTIVE_CALLS_RESPONSE>",
       "mode": "listen", // or "whisper" or "barge"
       "adminExtension": "999001"
     }
     ```
2. **Verification:**
   - The backend will route the request to the Python Barge service.
   - FreeSWITCH will place an outbound call to your Super Admin softphone registered as `999001`.
   - Your MicroSIP softphone registered as `999001` will begin **ringing**.
   - **Answer the call** on your `999001` softphone.
   - You should immediately hear the live conversation happening on the Agent (`100101`) softphone.
