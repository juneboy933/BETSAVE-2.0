"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AnimatedNumber from "../../components/AnimatedNumber";
import {
  clearAdminToken,
  getAdminOperatingMode,
  getAdminToken,
  hasAdminToken,
  request,
  setAdminOperatingMode
} from "../../lib/api";

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
  const [operatingMode, setOperatingModeState] = useState("live");
  const [stats, setStats] = useState({
    totalWalletBalance: 0,
    totalUsers: 0,
    totalEvents: 0,
    activePartners: 0,
    totalSavingsLedger: 0
  });
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const toPositiveNumber = (value) => Math.max(0, Number(value) || 0);
  const loadDashboardShellData = async () => {
    try {
      const headers = { "x-admin-token": getAdminToken() };
      const [overview, notifications] = await Promise.all([
        request("/api/v1/dashboard/admin/overview", { headers }),
        request("/api/v1/dashboard/admin/notifications/summary", { headers })
      ]);
      setStats({
        totalWalletBalance: toPositiveNumber(overview.metrics?.totalWalletBalance),
        totalUsers: toPositiveNumber(overview.metrics?.totalUsers),
        totalEvents: toPositiveNumber(overview.metrics?.totalEvents),
        activePartners: toPositiveNumber(overview.metrics?.activePartners),
        totalSavingsLedger: toPositiveNumber(overview.metrics?.totalSavingsLedger)
      });
      setUnreadNotifications(toPositiveNumber(notifications.unreadCount));
    } catch {}
  };

  useEffect(() => {
    if (!hasAdminToken()) {
      router.replace("/login");
      return;
    }
    setOperatingModeState(getAdminOperatingMode());
    loadDashboardShellData();
    const intervalId = setInterval(loadDashboardShellData, 10000);
    return () => clearInterval(intervalId);
  }, [router]);

  const switchOperatingMode = async (nextMode) => {
    const targetMode = String(nextMode || "").trim().toLowerCase() === "demo" ? "demo" : "live";
    if (targetMode === operatingMode) return;

    setAdminOperatingMode(targetMode);
    setOperatingModeState(targetMode);
    window.dispatchEvent(new Event("admin-mode-changed"));
    await loadDashboardShellData();
  };

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

      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin View Mode</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            className={`btn-secondary ${operatingMode === "demo" ? "border-slate-900 text-slate-900" : ""}`}
            onClick={() => switchOperatingMode("demo")}
          >
            Demo
          </button>
          <button
            className={`btn-secondary ${operatingMode === "live" ? "border-emerald-700 text-emerald-700" : ""}`}
            onClick={() => switchOperatingMode("live")}
          >
            Live
          </button>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${operatingMode === "live" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
            {operatingMode.toUpperCase()}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Demo mode shows only demo partner event streams. Live mode shows only live production event streams.
        </p>
      </section>

      <section className="kpi-grid">
        <article className="kpi-tile tile-gradient-ocean">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Wallet Balance</p>
          <p className="mt-1 text-2xl font-bold text-slate-900"><AnimatedNumber value={stats.totalWalletBalance} /></p>
        </article>
        <article className="kpi-tile tile-gradient-mint">
          <p className="text-xs uppercase tracking-wide text-slate-500">Users</p>
          <p className="mt-1 text-2xl font-bold text-slate-900"><AnimatedNumber value={stats.totalUsers} /></p>
        </article>
        <article className="kpi-tile tile-gradient-sun">
          <p className="text-xs uppercase tracking-wide text-slate-500">Processed Events</p>
          <p className="mt-1 text-2xl font-bold text-slate-900"><AnimatedNumber value={stats.totalEvents} /></p>
        </article>
        <article className="kpi-tile tile-gradient-violet">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active Partners</p>
          <p className="mt-1 text-2xl font-bold text-slate-900"><AnimatedNumber value={stats.activePartners} /></p>
        </article>
        <article className="kpi-tile tile-gradient-rose">
          <p className="text-xs uppercase tracking-wide text-slate-500">Savings Ledger Total</p>
          <p className="mt-1 text-2xl font-bold text-slate-900"><AnimatedNumber value={stats.totalSavingsLedger} /></p>
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
