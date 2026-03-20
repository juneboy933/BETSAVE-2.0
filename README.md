# Betsave 2.0

Betsave is an event-driven savings platform for betting partners.

When a partner sends a bet event, Betsave ingests it, processes it asynchronously, calculates a savings portion, posts balanced ledger entries, updates the user's wallet, and exposes analytics in separate Partner and Admin frontends.

## Project Structure

- `Backend/` Express API, MongoDB models, BullMQ workers, payment and recovery services
- `PartnerFrontend/` Next.js partner portal (port `5181`)
- `AdminFrontend/` Next.js admin portal (port `5182`)
- `docker-compose.prod.yml` production-oriented Docker Compose stack with Mongo replica set bootstrap
- `.env.production.example` deployment environment template
- `INTEGRATION.md` partner/backend integration guide

## Core Flow

1. A partner operator registers with email and password and receives a one-time `apiKey` and `apiSecret`.
2. The partner backend signs and sends a bet event.
3. Betsave ingests the event and queues it for processing.
4. The event worker validates the event, calculates savings, initiates payment collection, and links the payment transaction to the event.
5. Deposit callbacks finalize the event, post balanced ledger entries, and update the wallet.
6. The webhook worker notifies the partner of terminal event outcomes.
7. The recovery worker reconciles stale in-flight operations and surfaces stale pending work.

## Backend API Overview

Base URL: `http://localhost:5000`

### Public / Auth

- `GET /health`
- `POST /api/v1/register`
- `POST /api/v1/partners/auth/register`
- `POST /api/v1/partners/auth/login`
- `POST /api/v1/admin/auth/login`
- `POST /api/v1/admin/auth/register-with-invitation`

### Partner Integration

Signed integration requests require:

- `x-api-key`
- `x-timestamp`
- `x-signature`
- `x-integration-token` for live-mode write requests

Endpoints:

- `POST /api/v1/partners/events`
- `POST /api/v1/partners/users/register`
- `POST /api/v1/partners/users/verify-otp`

### Partner Dashboard

Dashboard requests use the partner session cookie issued during login.

- `GET /api/v1/dashboard/partner/events`
- `GET /api/v1/dashboard/partner/analytics`
- `GET /api/v1/dashboard/partner/savings-behavior`
- `GET /api/v1/dashboard/partner/users`
- `GET /api/v1/dashboard/partner/notifications`

### User Dashboard

Header:

- `x-user-token`

Endpoints:

- `GET /api/v1/dashboard/user/:userId`
- `GET /api/v1/dashboard/user/:userId/events`
- `GET /api/v1/dashboard/user/:userId/transactions`

### Admin Dashboard

Header:

- admin session cookie

Endpoints:

- `GET /api/v1/dashboard/admin/overview`
- `GET /api/v1/dashboard/admin/partners`
- `PATCH /api/v1/dashboard/admin/partners/:partnerId/status`
- `GET /api/v1/dashboard/admin/users`
- `GET /api/v1/dashboard/admin/events`
- `GET /api/v1/dashboard/admin/savings`
- `GET /api/v1/dashboard/admin/operations`
- `POST /api/v1/dashboard/admin/operations/reconciliation-runs`

Admin access routes:

- `GET /api/v1/admin/auth/session`
- `POST /api/v1/admin/auth/invitations`
- `GET /api/v1/admin/auth/invitations`
- `DELETE /api/v1/admin/auth/invitations/:invitationId`

## Data and Accounting Model

- Wallet balances are stored in `Wallet.balance`.
- Each wallet-affecting flow posts balanced ledger entries.
- Ledger writes are deduplicated with per-entry idempotency keys.
- Production money flows expect MongoDB transaction support from a replica set or mongos deployment.

## Demo vs Live

- Partner `demo` mode and `live` mode are separated by `operatingMode` on events and event references.
- Demo event collection can still trigger real STK collection, callback handling, ledger writes, and payment records when Daraja collection is configured.
- Demo-mode ledger exposure is intended for demo analytics and demo partner views only.
- Demo mode does not increase the user's live spendable wallet balance in `Wallet.balance`.
- Admin dashboards can switch between `demo` and `live` to inspect each slice independently.

## Local Setup

Create `Backend/.env` from `Backend/.env.example`.

Important notes:

- Standalone local MongoDB is acceptable for UI/demo work when `MONGO_REQUIRE_TRANSACTIONS=false`.
- Production-grade accounting requires MongoDB transaction support; the Docker stack configures a single-node replica set for this.

### 1. Start Infrastructure

- Start MongoDB
- Start Redis

### 2. Start Backend API

```powershell
cd "Backend"
npm install
npm run dev
```

### 3. Start Workers

```powershell
cd "Backend"
npm run worker:event
```

```powershell
cd "Backend"
npm run worker:webhook
```

```powershell
cd "Backend"
npm run worker:recovery
```

### 4. Start Frontends

Partner:

```powershell
cd "PartnerFrontend"
npm install
npm run dev
```

Admin:

```powershell
cd "AdminFrontend"
npm install
npm run dev
```

## Deployment With Docker

This repo includes a production-oriented Docker Compose stack that:

- boots MongoDB as a replica set
- secures Redis with a password
- starts the API, event worker, webhook worker, and recovery worker
- builds both frontends

### 1. Prepare Environment

```powershell
Copy-Item .env.production.example .env
```

Then edit `.env` with real values for:

- `MONGO_INITDB_ROOT_USERNAME`
- `MONGO_INITDB_ROOT_PASSWORD`
- `REDIS_PASSWORD`
- `USER_JWT_SECRET`
- `PARTNER_JWT_SECRET`
- `PARTNER_SECRET_ENCRYPTION_KEY`
- `PAYMENT_CALLBACK_TOKEN`
- `NEXT_PUBLIC_API_BASE_URL`
- `CORS_ALLOWED_ORIGINS`
- Daraja variables if payments are enabled

`PAYMENT_CALLBACK_TOKEN` is used server-side to derive per-transaction signed Daraja callback URLs. Do not expose it directly in public callback URLs, frontend code, or shared docs.

### 2. Build and Run

```powershell
docker compose -f docker-compose.prod.yml up -d --build
```

### 3. Verify

- `GET /health` returns `200`
- partner login works
- admin login works
- event worker, webhook worker, and recovery worker logs are healthy

### 4. Stop

```powershell
docker compose -f docker-compose.prod.yml down
```

### 5. Stop and Remove Mongo Data

```powershell
docker compose -f docker-compose.prod.yml down -v
```

## Production Notes

- Keep API, workers, MongoDB, and Redis running under orchestration.
- Put Nginx or Caddy in front for HTTPS and domain routing.
- Keep API secrets in backend secret management only.
- Set `CORS_ALLOWED_ORIGINS` explicitly in production.
- Monitor stale pending deposits, stale pending withdrawals, and stale processing events from the admin operations view.
- Monitor unsettled successful deposits and reconciliation runs from the admin operations view.
- Do not rely on the browser to retain partner integration secrets.
- Existing admins issue invitation codes from the admin dashboard Access view and send those codes to new admins through a secure out-of-band channel.
- Only the primary admin created during bootstrap can issue, view, or revoke admin invitation codes.
- Use `INTEGRATION.md` as the implementation guide for partner backend teams.
