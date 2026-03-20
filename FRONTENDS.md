# Separate Frontends (Next.js + Tailwind)

## Partner Frontend

Path: `PartnerFrontend`

Run:

```powershell
cd "c:\Users\Brian\Desktop\Betsave 2.0\PartnerFrontend"
npm install
npm run dev
```

Default URL: `http://localhost:5181`

Pages:
- `/` home page (summary + register/login buttons)
- `/register` partner registration
- `/login` partner login using the partner session cookie
- `/dashboard` authenticated dashboard with top totals + sidebar
- `/dashboard/users` partner users table
- `/dashboard/events` events table with event status, payment state, and savings amount
- `/dashboard/analytics` analytics and behavior tables
- `/dashboard/notifications` operational partner notifications

Notes:
- Partner dashboard pages are operator views only.
- Signed integration credentials belong on the partner backend, not in browser code.
- Demo-only controls are intentionally reduced in live mode.

## Admin Frontend

Path: `AdminFrontend`

Run:

```powershell
cd "c:\Users\Brian\Desktop\Betsave 2.0\AdminFrontend"
npm install
npm run dev
```

Default URL: `http://localhost:5182`

Pages:
- `/` home page (summary + register/login buttons)
- `/register` admin registration
- `/login` admin login using the admin session cookie
- `/dashboard` authenticated dashboard with top totals + sidebar
- `/dashboard/partners` partner governance table + status updates
- `/dashboard/users` users table
- `/dashboard/events` events table
- `/dashboard/savings` savings tables
- `/dashboard/operations` operational readiness tables

Notes:
- Admin dashboard uses the admin session cookie.
- Access management is limited to the primary admin.
- Operations view includes settlement backlog, stale work, and reconciliation run visibility.

## Backend

Ensure backend is running at `http://localhost:5000`.
