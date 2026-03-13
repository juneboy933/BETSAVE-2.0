"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AnimatedNumber from "../../components/AnimatedNumber";
import {
  clearPartnerCreds,
  getPartnerName,
  getPartnerOperatingMode,
  markPartnerSessionActive,
  partnerRequest,
  setPartnerOperatingMode,
} from "../../lib/api";
import { attachVisiblePolling } from "../../lib/polling";

const navLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/events", label: "Events" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/user-demo", label: "User Demo", demoOnly: true },
  { href: "/dashboard/notifications", label: "Notifications" }
];

export default function PartnerDashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [operatingMode, setOperatingModeState] = useState("demo");
  const [modeUpdating, setModeUpdating] = useState(false);
  const [modeError, setModeError] = useState("");
  const [stats, setStats] = useState({
    totalWalletBalance: 0,
    totalUsers: 0,
    totalEvents: 0,
    totalProcessedAmount: 0,
    totalSavings: 0
  });
  const toPositiveNumber = (value) => Math.max(0, Number(value) || 0);
  const modeDescription =
    operatingMode === "live"
      ? "Live mode applies partner actions to production settlement flows."
      : "Demo mode records partner-scoped demo ledger activity while keeping the user's live spendable wallet untouched.";
  const displayPartnerName = (() => {
    if (partnerName) return partnerName;
    return "Partner Workspace";
  })();

  const load = useCallback(async () => {
    try {
      setModeError("");
      const [analytics, users, notifications, mode] = await Promise.all([
        partnerRequest("/api/v1/dashboard/partner/analytics"),
        partnerRequest("/api/v1/dashboard/partner/users?page=1&limit=1"),
        partnerRequest("/api/v1/dashboard/partner/notifications/summary"),
        partnerRequest("/api/v1/partners/mode")
      ]);
      const processedEvents = (analytics.stat || []).find((item) => item._id === "PROCESSED")?.count || 0;
      setStats({
        totalWalletBalance: toPositiveNumber(analytics.totalWalletBalance),
        totalUsers: toPositiveNumber(users.total),
        totalEvents: toPositiveNumber(processedEvents),
        totalProcessedAmount: toPositiveNumber(analytics.totalProcessedAmount),
        totalSavings: toPositiveNumber(analytics.totalSavings)
      });
      setUnreadNotifications(toPositiveNumber(notifications.unreadCount));
      const nextMode = String(mode?.partner?.operatingMode || "demo").toLowerCase() === "live" ? "live" : "demo";
      setOperatingModeState(nextMode);
      setPartnerOperatingMode(nextMode);
      markPartnerSessionActive();
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        clearPartnerCreds();
        router.replace("/login");
        return;
      }
      setModeError(error.message || "Failed to load dashboard shell");
    }
  }, [router]);

  useEffect(() => {
    setPartnerName(getPartnerName());
    setOperatingModeState(getPartnerOperatingMode());
    return attachVisiblePolling(load);
  }, [load]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const switchOperatingMode = async (nextMode) => {
    const targetMode = String(nextMode || "").toLowerCase() === "live" ? "live" : "demo";
    if (targetMode === operatingMode || modeUpdating) return;

    try {
      setModeUpdating(true);
      setModeError("");
      const data = await partnerRequest("/api/v1/partners/mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operatingMode: targetMode })
      });

      const modeFromApi = String(data?.partner?.operatingMode || targetMode).toLowerCase() === "live" ? "live" : "demo";
      setOperatingModeState(modeFromApi);
      setPartnerOperatingMode(modeFromApi);
      window.dispatchEvent(new Event("partner-mode-changed"));
    } catch (error) {
      setModeError(error.message || "Failed to update mode");
    } finally {
      setModeUpdating(false);
    }
  };

  const visibleNavLinks = navLinks.filter((link) => !(link.demoOnly && operatingMode === "live"));

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
              <p className="brand-subtitle">Partner Dashboard</p>
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
                await partnerRequest("/api/v1/partners/auth/logout", {
                  method: "POST"
                });
              } catch {}
              clearPartnerCreds();
              router.push("/login");
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <section className="card overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(35,64,100,0.18),_transparent_38%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(244,247,252,0.9))]">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Partner workspace</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">{displayPartnerName}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{modeDescription}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Wallet scope</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  <AnimatedNumber value={stats.totalWalletBalance} />
                </p>
              </article>
              <article className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Total savings</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  <AnimatedNumber value={stats.totalSavings} />
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
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Operating mode</p>
                <p className="mt-2 text-xl font-semibold">{operatingMode.toUpperCase()}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${operatingMode === "live" ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-800 text-slate-200"}`}>
                {modeUpdating ? "Updating..." : "Active"}
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
                disabled={modeUpdating}
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
                disabled={modeUpdating}
              >
                Live
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Dashboard access uses the partner session cookie. Demo records stay visible only in demo mode, while signed credentials stay reserved for backend integrations.
            </p>
            {modeError ? <p className="mt-3 text-sm font-semibold text-rose-300">{modeError}</p> : null}
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-tile tile-gradient-ocean">
          <p className="text-xs uppercase tracking-wide text-slate-500">Attributed Wallet Balance</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            <AnimatedNumber value={stats.totalWalletBalance} />
          </p>
        </article>
        <article className="kpi-tile tile-gradient-mint">
          <p className="text-xs uppercase tracking-wide text-slate-500">Registered Users</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            <AnimatedNumber value={stats.totalUsers} />
          </p>
        </article>
        <article className="kpi-tile tile-gradient-sun">
          <p className="text-xs uppercase tracking-wide text-slate-500">Events</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            <AnimatedNumber value={stats.totalEvents} />
          </p>
        </article>
        <article className="kpi-tile tile-gradient-violet">
          <p className="text-xs uppercase tracking-wide text-slate-500">Processed Event Amount</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            <AnimatedNumber value={stats.totalProcessedAmount} />
          </p>
        </article>
        <article className="kpi-tile tile-gradient-rose">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Savings</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            <AnimatedNumber value={stats.totalSavings} />
          </p>
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

      <footer className="site-footer">Betsave Partner Portal</footer>
    </section>
  );
}
