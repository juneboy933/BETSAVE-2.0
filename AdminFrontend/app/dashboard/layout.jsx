"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AnimatedNumber from "../../components/AnimatedNumber";
import {
  clearAdminToken,
  getAdminOperatingMode,
  markAdminSessionActive,
  request,
  setAdminOperatingMode
} from "../../lib/api";
import { attachVisiblePolling } from "../../lib/polling";

const navLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/access", label: "Access", primaryAdminOnly: true },
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
  const [navOpen, setNavOpen] = useState(false);
  const [operatingMode, setOperatingModeState] = useState("live");
  const [stats, setStats] = useState({
    totalWalletBalance: 0,
    totalUsers: 0,
    totalEvents: 0,
    activePartners: 0,
    totalSavingsLedger: 0
  });
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [shellError, setShellError] = useState("");
  const [canManageAdminInvitations, setCanManageAdminInvitations] = useState(false);
  const toPositiveNumber = (value) => Math.max(0, Number(value) || 0);
  const loadDashboardShellData = useCallback(async () => {
    try {
      setShellError("");
      const [overview, notifications, session] = await Promise.all([
        request("/api/v1/dashboard/admin/overview"),
        request("/api/v1/dashboard/admin/notifications/summary"),
        request("/api/v1/admin/auth/session")
      ]);
      setStats({
        totalWalletBalance: toPositiveNumber(overview.metrics?.totalWalletBalance),
        totalUsers: toPositiveNumber(overview.metrics?.totalUsers),
        totalEvents: toPositiveNumber(overview.metrics?.totalEvents),
        activePartners: toPositiveNumber(overview.metrics?.activePartners),
        totalSavingsLedger: toPositiveNumber(overview.metrics?.totalSavingsLedger)
      });
      setUnreadNotifications(toPositiveNumber(notifications.unreadCount));
      setCanManageAdminInvitations(Boolean(session?.admin?.canManageAdminInvitations));
      markAdminSessionActive();
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        clearAdminToken();
        router.replace("/login");
        return;
      }
      setShellError(error.message || "Failed to load admin shell");
    }
  }, [router]);

  useEffect(() => {
    setOperatingModeState(getAdminOperatingMode());
    return attachVisiblePolling(loadDashboardShellData);
  }, [loadDashboardShellData]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const switchOperatingMode = async (nextMode) => {
    const targetMode = String(nextMode || "").trim().toLowerCase() === "demo" ? "demo" : "live";
    if (targetMode === operatingMode) return;

    setAdminOperatingMode(targetMode);
    setOperatingModeState(targetMode);
    window.dispatchEvent(new Event("admin-mode-changed"));
    await loadDashboardShellData();
  };

  const visibleNavLinks = navLinks.filter((link) => !(link.primaryAdminOnly && !canManageAdminInvitations));

  return (
    <section className="dashboard-shell">
      <header className="nav-shell">
        <div className="flex flex-1 items-center gap-3">
          <button
            type="button"
            className="btn-secondary px-4 py-2 lg:hidden"
            onClick={() => setNavOpen((current) => !current)}
          >
            {navOpen ? "Close Menu" : "Open Menu"}
          </button>
          <Link href="/" className="brand-lockup">
            <div className="brand-logo">B</div>
            <div>
              <p className="brand-title">Betsave</p>
              <p className="brand-subtitle">Admin Dashboard</p>
            </div>
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${operatingMode === "live" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
            {operatingMode.toUpperCase()}
          </span>
          <button
            className="btn-secondary"
            onClick={async () => {
              try {
                await request("/api/v1/admin/auth/logout", {
                  method: "POST"
                });
              } catch {}
              clearAdminToken();
              router.push("/login");
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <section className="card overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,60,95,0.18),_transparent_38%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(243,246,251,0.92))]">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Control center</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Operational governance</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Use this shell to monitor partner exposure, event throughput, and savings performance without losing context on mobile or desktop.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Total users</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  <AnimatedNumber value={stats.totalUsers} />
                </p>
              </article>
              <article className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Active partners</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  <AnimatedNumber value={stats.activePartners} />
                </p>
              </article>
              <article className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Unread notifications</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  <AnimatedNumber value={unreadNotifications} />
                </p>
              </article>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-slate-950 p-5 text-slate-50 shadow-xl shadow-slate-900/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Admin view mode</p>
                <p className="mt-2 text-xl font-semibold">{operatingMode.toUpperCase()}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${operatingMode === "live" ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-800 text-slate-200"}`}>
                Scoped
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  operatingMode === "demo"
                    ? "border-white/60 bg-white text-slate-950"
                    : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
                }`}
                onClick={() => switchOperatingMode("demo")}
              >
                Demo
              </button>
              <button
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  operatingMode === "live"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                    : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
                }`}
                onClick={() => switchOperatingMode("live")}
              >
                Live
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Demo mode filters admin insights to demo partner traffic and demo-scoped ledger exposure. Live mode shows production activity only.
            </p>
            {shellError ? <p className="mt-3 text-sm font-semibold text-rose-300">{shellError}</p> : null}
          </div>
        </div>
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
        <aside className={`sidebar ${navOpen ? "block" : "hidden"} lg:block`}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Navigation</p>
          <nav className="space-y-2">
            {visibleNavLinks.map((n) => (
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
