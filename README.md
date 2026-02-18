# Betsave 2.0

Betsave is an event-driven savings platform for betting partners.

When a partner sends a bet event, Betsave ingests it, processes it asynchronously, calculates a savings portion, posts balanced ledger entries, updates the user's wallet, and exposes analytics in separate Partner and Admin frontends.

## Project Structure

- `Backend/` Express API + MongoDB models + BullMQ workers
- `PartnerFrontend/` Next.js + Tailwind partner portal (port `5181`)
- `AdminFrontend/` Next.js + Tailwind admin portal (port `5182`)
- `FRONTENDS.md` quick frontend run guide

## Core Flow

1. Partner registers and receives `apiKey` + `apiSecret`.
2. Partner sends signed event (`BET_PLACED`) to Betsave.
3. Betsave ingests event (`RECEIVED`) and queues processing.
4. Event worker processes the event:
   - validates amount
   - computes savings (`SAVINGS_PERCENTAGE`)
   - posts double-entry ledger records
   - credits wallet
   - marks event status (`PROCESSED` or `FAILED`)
5. Webhook worker notifies partner system of final outcome.
6. Partner/Admin dashboards show live operational and financial data.

## Tech Stack

### Backend

- Node.js (ESM)
- Express
- MongoDB + Mongoose
- Redis + BullMQ

### Frontends

- Next.js 15
- React 18
- Tailwind CSS

## Backend API Overview

Base URL: `http://localhost:5000`

### Public / Auth

- `GET /health`
- `POST /api/v1/register` register user (phone)
- `POST /api/v1/partners/create` register partner
- `POST /api/v1/partners/login` partner login
- `POST /api/v1/admin/auth/register` admin register
- `POST /api/v1/admin/auth/login` admin login

### Partner (signed)

Headers:
- `x-api-key`
- `x-timestamp`
- `x-signature`

Endpoints:
- `POST /api/v1/partners/events`
- `POST /api/v1/partners/users/register`
- `GET /api/v1/dashboard/partner/events`
- `GET /api/v1/dashboard/partner/users`
- `GET /api/v1/dashboard/partner/analytics`
- `GET /api/v1/dashboard/partner/savings-behavior`

### User Dashboard

Header:
- `x-user-phone`

Endpoints:
- `GET /api/v1/dashboard/user/:userId`
- `GET /api/v1/dashboard/user/:userId/events`
- `GET /api/v1/dashboard/user/:userId/transactions`

### Admin Dashboard

Header:
- `x-admin-token`

Endpoints:
- `GET /api/v1/dashboard/admin/overview`
- `GET /api/v1/dashboard/admin/partners`
- `PATCH /api/v1/dashboard/admin/partners/:partnerId/status`
- `GET /api/v1/dashboard/admin/users`
- `GET /api/v1/dashboard/admin/events`
- `GET /api/v1/dashboard/admin/savings`
- `GET /api/v1/dashboard/admin/operations`

## Data and Accounting Model

- Wallet balances are stored in `Wallet.balance`.
- Each successful savings credit writes balanced ledger entries:
  - `OPERATOR_CLEARING: -amount`
  - `USER_SAVINGS: +amount`
- Wallet is incremented by the credited savings amount.

## Environment Variables

Create `Backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/betsave
REDIS_URI=redis://localhost:6379
SAVINGS_PERCENTAGE=0.1

# Admin middleware
ADMIN_DASHBOARD_TOKEN=your_secure_admin_token

# Optional operations readiness flags
BANK_API_URL=
BANK_API_KEY=
BANK_SETTLEMENT_ACCOUNT=
```

Optional frontend API base:

- `PartnerFrontend/.env.local`
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000`
- `AdminFrontend/.env.local`
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000`

## Local Setup

## 1. Start infrastructure

- Start MongoDB
- Start Redis

## 2. Start backend API

```powershell
cd "Backend"
npm install
npm run dev
```

## 3. Start workers (separate terminals)

```powershell
cd "Backend"
node worker/event.worker.js
```

```powershell
cd "Backend"
node worker/webhook.worker.js
```

## 4. Start frontends

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

## URLs

- Partner frontend: `http://localhost:5181`
- Admin frontend: `http://localhost:5182`
- Backend API: `http://localhost:5000`

## UI Notes

- Dashboards auto-refresh every 10 seconds.
- Event status colors:
  - `PROCESSED` green
  - `FAILED` red
- Credit/debit cells use light red/green backgrounds with darker bold text for clarity.

## Production Notes

- Keep API + workers + Redis always running.
- Use a process manager (PM2/systemd/container orchestration).
- Store `apiSecret` and admin tokens securely.
- Keep webhook retries and dead-letter monitoring enabled.

## Deploy With Docker (Recommended Quick Start)

This repo includes:

- `Backend/Dockerfile`
- `PartnerFrontend/Dockerfile`
- `AdminFrontend/Dockerfile`
- `docker-compose.prod.yml`

### 1. Build and run everything

```powershell
docker compose -f docker-compose.prod.yml up -d --build
```

### 2. Access services

- Partner frontend: `http://localhost:5181`
- Admin frontend: `http://localhost:5182`
- Backend API: `http://localhost:5000`

### 3. Stop

```powershell
docker compose -f docker-compose.prod.yml down
```

### 4. Stop and remove persisted Mongo data

```powershell
docker compose -f docker-compose.prod.yml down -v
```

## Deploy To Cloud VM

1. Provision a Linux VM (Ubuntu/Debian).
2. Install Docker + Docker Compose plugin.
3. Clone this repo.
4. Edit `docker-compose.prod.yml` env values:
   - `ADMIN_DASHBOARD_TOKEN`
   - `SAVINGS_PERCENTAGE`
   - `BANK_*` values
   - set frontend API URL to your public backend URL
5. Run:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

6. Put Nginx/Caddy in front for HTTPS + domain routing.
