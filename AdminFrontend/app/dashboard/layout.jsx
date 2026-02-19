"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAdminToken, getAdminToken, hasAdminToken, request } from "../../lib/api";

const navLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/partners", label: "Partners" },
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/events", label: "Events" },
  { href: "/dashboard/savings", label: "Savings" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/operations", label: "Operations" }
];

export default function AdminDashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [stats, setStats] = useState({ totalWalletBalance: 0, totalUsers: 0, totalEvents: 0 });
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const toPositiveNumber = (value) => Math.max(0, Number(value) || 0);

  useEffect(() => {
    if (!hasAdminToken()) {
      router.replace("/login");
      return;
    }
    const load = async () => {
      try {
        const headers = { "x-admin-token": getAdminToken() };
        const [overview, notifications] = await Promise.all([
          request("/api/v1/dashboard/admin/overview", { headers }),
          request("/api/v1/dashboard/admin/notifications/summary", { headers })
        ]);
        setStats({
          totalWalletBalance: toPositiveNumber(overview.metrics?.totalWalletBalance),
          totalUsers: toPositiveNumber(overview.metrics?.totalUsers),
          totalEvents: toPositiveNumber(overview.metrics?.totalEvents)
        });
        setUnreadNotifications(toPositiveNumber(notifications.unreadCount));
      } catch {}
    };
    load();
    const intervalId = setInterval(load, 10000);
    return () => clearInterval(intervalId);
  }, [router]);

  return (
    <section className="dashboard-shell">
      <header className="nav-shell">
        <Link href="/" className="brand-lockup">
          <div className="brand-logo">B</div>
          <div>
            <p className="brand-title">Betsave</p>
            <p className="brand-subtitle">Admin Dashboard</p>
          </div>
        </Link>
        <button
          className="btn-secondary"
          onClick={() => {
            clearAdminToken();
            router.push("/login");
          }}
        >
          Logout
        </button>
      </header>

      <section className="kpi-grid">
        <article className="kpi-tile">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Wallet Balance</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalWalletBalance}</p>
        </article>
        <article className="kpi-tile">
          <p className="text-xs uppercase tracking-wide text-slate-500">Users</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalUsers}</p>
        </article>
        <article className="kpi-tile">
          <p className="text-xs uppercase tracking-wide text-slate-500">Events</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalEvents}</p>
        </article>
      </section>

      <div className="dashboard-body">
        <aside className="sidebar">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Navigation</p>
          <nav className="space-y-2">
            {navLinks.map((n) => (
              <Link key={n.href} href={n.href} className={`sidebar-link ${pathname === n.href ? "active" : ""}`}>
                <span className="flex items-center justify-between">
                  <span>{n.label}</span>
                  {n.href === "/dashboard/notifications" && unreadNotifications > 0 ? (
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  ) : null}
                </span>
              </Link>
            ))}
          </nav>
        </aside>

        <section className="card">{children}</section>
      </div>

      <footer className="site-footer">Betsave Admin Portal</footer>
    </section>
  );
}
