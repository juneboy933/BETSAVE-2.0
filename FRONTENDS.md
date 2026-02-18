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
- `/login` partner login
- `/dashboard` authenticated dashboard with top totals + sidebar
- `/dashboard/users` partner users table
- `/dashboard/events` events table (status + savings amount)
- `/dashboard/analytics` analytics and behavior tables

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
- `/login` admin login
- `/dashboard` authenticated dashboard with top totals + sidebar
- `/dashboard/partners` partner governance table + status updates
- `/dashboard/users` users table
- `/dashboard/events` events table
- `/dashboard/savings` savings tables
- `/dashboard/operations` operational readiness tables

## Backend

Ensure backend is running at `http://localhost:5000`.
