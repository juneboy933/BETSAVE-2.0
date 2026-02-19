"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearPartnerCreds, getPartnerCreds, getPartnerName, hasPartnerCreds, signedRequest } from "../../lib/api";

const navLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/events", label: "Events" },
  { href: "/dashboard/analytics", label: "Analytics" }
];

export default function PartnerDashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [partnerName, setPartnerName] = useState("");
  const [stats, setStats] = useState({ totalWalletBalance: 0, totalUsers: 0, totalEvents: 0, totalProcessedAmount: 0 });
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
    const load = async () => {
      try {
        const creds = getPartnerCreds();
        const [a, u] = await Promise.all([
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
          })
        ]);
        const processedEvents = (a.stat || []).find((item) => item._id === "PROCESSED")?.count || 0;
        setStats({
          totalWalletBalance: toPositiveNumber(a.totalWalletBalance),
          totalUsers: toPositiveNumber(u.total),
          totalEvents: toPositiveNumber(processedEvents),
          totalProcessedAmount: toPositiveNumber(a.totalProcessedAmount)
        });
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
        <p className="text-xs uppercase tracking-wide text-slate-500">Logged In Partner</p>
        <p className="text-lg font-bold text-slate-900">{displayPartnerName}</p>
      </section>

      <section className="kpi-grid">
        <article className="kpi-tile">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Wallet Balance</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalWalletBalance}</p>
        </article>
        <article className="kpi-tile">
          <p className="text-xs uppercase tracking-wide text-slate-500">Registered Users</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalUsers}</p>
        </article>
        <article className="kpi-tile">
          <p className="text-xs uppercase tracking-wide text-slate-500">Events</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalEvents}</p>
        </article>
        <article className="kpi-tile">
          <p className="text-xs uppercase tracking-wide text-slate-500">Processed Event Amount</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalProcessedAmount}</p>
        </article>
      </section>

      <div className="dashboard-body">
        <aside className="sidebar">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Navigation</p>
          <nav className="space-y-2">
            {navLinks.map((n) => (
              <Link key={n.href} href={n.href} className={`sidebar-link ${pathname === n.href ? "active" : ""}`}>
                {n.label}
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
