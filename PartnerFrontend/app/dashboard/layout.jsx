"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AnimatedNumber from "../../components/AnimatedNumber";
import {
  clearPartnerCreds,
  getPartnerCreds,
  getPartnerName,
  getPartnerOperatingMode,
  hasPartnerCreds,
  setPartnerOperatingMode,
  signedRequest
} from "../../lib/api";

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
  const displayPartnerName = (() => {
    if (partnerName) return partnerName;
    const { apiKey } = getPartnerCreds();
    const inferred = String(apiKey || "").split("_")[0].replace(/_/g, " ").trim();
    return inferred || "Unknown Partner";
  })();

  useEffect(() => {
    if (!hasPartnerCreds()) {
      router.replace("/login");
      return;
    }
    setPartnerName(getPartnerName());
    setOperatingModeState(getPartnerOperatingMode());
    const load = async () => {
      try {
        const creds = getPartnerCreds();
        const [a, u, n, m] = await Promise.all([
          signedRequest({
            method: "GET",
            path: "/api/v1/dashboard/partner/analytics",
            body: {},
            apiKey: creds.apiKey,
            apiSecret: creds.apiSecret
          }),
          signedRequest({
            method: "GET",
            path: "/api/v1/dashboard/partner/users?page=1&limit=1",
            body: {},
            apiKey: creds.apiKey,
            apiSecret: creds.apiSecret
          }),
          signedRequest({
            method: "GET",
            path: "/api/v1/dashboard/partner/notifications/summary",
            body: {},
            apiKey: creds.apiKey,
            apiSecret: creds.apiSecret
          }),
          signedRequest({
            method: "GET",
            path: "/api/v1/partners/mode",
            body: {},
            apiKey: creds.apiKey,
            apiSecret: creds.apiSecret
          })
        ]);
        const processedEvents = (a.stat || []).find((item) => item._id === "PROCESSED")?.count || 0;
        setStats({
          totalWalletBalance: toPositiveNumber(a.totalWalletBalance),
          totalUsers: toPositiveNumber(u.total),
          totalEvents: toPositiveNumber(processedEvents),
          totalProcessedAmount: toPositiveNumber(a.totalProcessedAmount),
          totalSavings: toPositiveNumber(a.totalSavings)
        });
        setUnreadNotifications(toPositiveNumber(n.unreadCount));
        const nextMode = String(m?.partner?.operatingMode || "demo").toLowerCase() === "live" ? "live" : "demo";
        setOperatingModeState(nextMode);
        setPartnerOperatingMode(nextMode);
      } catch {}
    };
    load();
    const intervalId = setInterval(load, 10000);
    return () => clearInterval(intervalId);
  }, [router]);

  const switchOperatingMode = async (nextMode) => {
    const targetMode = String(nextMode || "").toLowerCase() === "live" ? "live" : "demo";
    if (targetMode === operatingMode || modeUpdating) return;

    try {
      setModeUpdating(true);
      setModeError("");
      const creds = getPartnerCreds();
      const data = await signedRequest({
        method: "PATCH",
        path: "/api/v1/partners/mode",
        body: { operatingMode: targetMode },
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret
      });

      const modeFromApi = String(data?.partner?.operatingMode || targetMode).toLowerCase() === "live" ? "live" : "demo";
      setOperatingModeState(modeFromApi);
      setPartnerOperatingMode(modeFromApi);
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
        <Link href="/" className="brand-lockup">
          <div className="brand-logo">B</div>
          <div>
            <p className="brand-title">Betsave</p>
            <p className="brand-subtitle">Partner Dashboard</p>
          </div>
        </Link>
        <button
          className="btn-secondary"
          onClick={() => {
            clearPartnerCreds();
            router.push("/login");
          }}
        >
          Logout
        </button>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-lg font-bold text-slate-900">{displayPartnerName}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operating Mode</p>
          <button
            className={`btn-secondary ${operatingMode === "demo" ? "border-slate-900 text-slate-900" : ""}`}
            onClick={() => switchOperatingMode("demo")}
            disabled={modeUpdating}
          >
            Demo
          </button>
          <button
            className={`btn-secondary ${operatingMode === "live" ? "border-emerald-700 text-emerald-700" : ""}`}
            onClick={() => switchOperatingMode("live")}
            disabled={modeUpdating}
          >
            Live
          </button>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${operatingMode === "live" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
            {operatingMode.toUpperCase()}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Demo mode keeps live wallet balances unchanged for event-driven STK settlements. Live mode applies wallet credits on successful callbacks.
        </p>
        {modeError ? <p className="mt-1 text-xs font-semibold text-red-700">{modeError}</p> : null}
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
        <aside className="sidebar">
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
