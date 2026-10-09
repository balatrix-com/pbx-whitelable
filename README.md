# PBX-Whitelabel

Welcome to the **PBX-Whitelabel** repository! 

This document is designed to help any new developer, tester, or team member quickly understand what this system does, how it works, and how to start interacting with it.

---

## 📖 1. What is PBX-Whitelabel?

**PBX-Whitelabel** is a modern, cloud-based, multi-tenant PBX (Private Branch Exchange) system. 
It allows organizations (Partners) to provide telecom services (like phone numbers, interactive menus, call routing) to various businesses (Tenants). Because it is "Whitelabel," the system can be customized with different branding for different partners.

### Core Capabilities
- **Buy and Manage Phone Numbers**: Provision Local numbers (DIDs) and Toll-Free Numbers (TFNs).
- **Call Routing & IVR**: Visually build call flows, setup greeting audios, and route calls via Interactive Voice Response (IVR).
- **Ring Groups & Extensions**: Group employees together to ring simultaneously or sequentially.
- **Billing & Subscriptions**: Wallet-based balance tracking, Stripe integration, subscription plans, and per-minute usage billing.
- **Real-Time Monitoring**: View active calls and barge-in (listen/whisper/join) using WebSockets.

---

## 🏗️ 2. System Architecture & Tech Stack

The application is split into two main parts: a **Frontend** client and a **Backend** server.

### Frontend (`/frontend`)
- **React 19 & Vite**: The core UI framework and build tool.
- **Tailwind CSS**: For styling and responsive design.
- **React Query**: For fetching, caching, and updating API data.
- **@xyflow/react**: Powers the visual "drag-and-drop" Call Flow builder.
- **Socket.io-client**: Connects to the backend for real-time notifications and call monitoring.

### Backend (`/backend`)
- **NestJS**: The core server-side framework built on Node.js/TypeScript.
- **PostgreSQL & Prisma ORM**: The primary relational database and the tool used to query it.
- **Redis**: Used for high-speed caching, rate limiting, and background job queues.
- **Socket.io**: Pushes real-time events to the frontend.
- **Stripe API**: Handles payment processing, wallets, and subscriptions.

---

## 🗄️ 3. Core Database Entities (Domain Model)

To understand the system, you must understand these core concepts (which map to database tables):

1. **Partner (`Partner`)**: The top-level whitelabel entity. A partner owns the brand.
2. **Tenant (`Tenant`)**: A company/business that signs up to use the PBX under a Partner. All resources belong to a Tenant.
3. **Users (`User`)**: The people logging into the dashboard (Admins, Support, etc.).
4. **Phone Numbers**: 
   - **`DID`**: Direct Inward Dialing (Local/Mobile numbers).
   - **`TFN`**: Toll-Free Numbers.
5. **Extensions (`Extension`)**: SIP endpoints (like a desk phone or softphone app) assigned to employees.
6. **Ring Groups (`RingGroup`)**: A group of extensions that ring together based on a strategy (e.g., ring all at once).
7. **IVR (`IVR`)**: Interactive menus ("Press 1 for Sales, 2 for Support").
8. **Billing & Money**:
   - **`Wallet`**: A pre-paid balance for usage (minutes/calls).
   - **`Subscription` & `Plan`**: Recurring monthly/yearly charges for using the platform.

---

## 🚀 4. Getting Started (For Developers)

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL running locally or remotely
- Redis running locally or remotely
- A Stripe Sandbox Account (for billing tests)

### Backend Setup
1. Open terminal and navigate to `cd backend`.
2. Install dependencies: `npm install`.
3. Create a `.env` file based on `.env.example` (Ensure `DATABASE_URL` and `REDIS_URL` are set).
4. Run migrations/sync database: `npx prisma db push`.
5. Seed initial data (Plans, Roles): `npm run seed:ratecards` and `npm run seed:tfns`.
6. Start the server: `npm run start:dev`.

### Frontend Setup
1. Open a new terminal and navigate to `cd frontend`.
2. Install dependencies: `npm install`.
3. Create a `.env` file (Ensure `VITE_API_URL` points to your backend, usually `http://localhost:3000/api`).
4. Start the frontend server: `npm run dev`.

---

## 🧪 5. Guide for Testers & QA

If you are testing the system, here are the primary workflows you should verify:

### 1. Tenant Onboarding & Billing Flow
- **Test:** Can a new Tenant sign up?
- **Test:** Does creating a Tenant automatically generate a Wallet?
- **Test:** Can the Tenant add a payment method and top up their Wallet using Stripe test cards?
- **Test:** Can the Tenant subscribe to a Plan, and is the Wallet/Stripe billed correctly?

### 2. Asset Management
- **Test:** Can a Tenant search for and assign a new DID or TFN from the global inventory?
- **Test:** Does assigning a number deduct money from the wallet or check plan limits?
- **Test:** Can a Tenant release (unassign) a number?

### 3. Call Routing Features
- **Test:** Can a user create an Extension and view its SIP credentials?
- **Test:** Can a user create a Ring Group and assign multiple Extensions to it?
- **Test:** Can a user visually build an IVR, upload a greeting audio, and save the nodes?
- **Test:** Can a user map a DID to an IVR or an Extension using the Call Flow/Routing settings?

### 4. Real-Time Monitoring
- **Test:** When a simulated call event occurs on the backend, does the Frontend Live Dashboard update immediately without refreshing the page?

---

## 📚 6. Where to find more documentation?

- **API Documentation**: (Coming soon via Swagger at `/api/docs`)
- **Database Schema**: View `backend/prisma/schema.prisma` for the exact source of truth on database relations.
- **Specific Guides**: Check the `docs/` folder in the root directory for specific guides on Redis, Barge API, and Deployment.
