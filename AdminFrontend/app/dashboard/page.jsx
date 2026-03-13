"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
import AnimatedNumber from "../../components/AnimatedNumber";
import { request } from "../../lib/api";
import { attachVisiblePolling } from "../../lib/polling";
import { Pie } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function AdminDashboardOverview() {
  const [metrics, setMetrics] = useState(null);
  const [eventByStatus, setEventByStatus] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await request("/api/v1/dashboard/admin/overview");
      setMetrics(data.metrics || null);
      setEventByStatus(data.eventByStatus || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    return attachVisiblePolling(load);
  }, [load]);

  useEffect(() => {
    const onAdminModeChanged = () => {
      load();
    };
    window.addEventListener("admin-mode-changed", onAdminModeChanged);
    return () => window.removeEventListener("admin-mode-changed", onAdminModeChanged);
  }, [load]);

  const dominantStatus = useMemo(() => {
    return [...eventByStatus].sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))[0]?._id || "N/A";
  }, [eventByStatus]);

  return (
    <section className="space-y-4">
      <article className="card">
        <div className="section-head">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Overview</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Platform metrics</h2>
          </div>
          <button className="btn" onClick={load}>
            Refresh
          </button>
        </div>
        {error && <p className="mb-2 text-sm font-semibold text-rose-700">{error}</p>}
        {metrics && (
          <div className="stats-grid">
            <article className="metric-tile">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Users</p>
              <p className="mt-2 text-2xl font-bold text-slate-950"><AnimatedNumber value={metrics.totalUsers || 0} /></p>
            </article>
            <article className="metric-tile">
              <p className="text-xs uppercase tracking-wide text-slate-500">Active Partners</p>
              <p className="mt-2 text-2xl font-bold text-slate-950"><AnimatedNumber value={metrics.activePartners || 0} /></p>
            </article>
            <article className="metric-tile">
              <p className="text-xs uppercase tracking-wide text-slate-500">Processed Events</p>
              <p className="mt-2 text-2xl font-bold text-slate-950"><AnimatedNumber value={metrics.totalEvents || 0} /></p>
            </article>
            <article className="metric-tile">
              <p className="text-xs uppercase tracking-wide text-slate-500">Savings Ledger Total</p>
              <p className="mt-2 text-2xl font-bold text-slate-950"><AnimatedNumber value={metrics.totalSavingsLedger || 0} /></p>
            </article>
          </div>
        )}
        {!metrics && !error && (
          <div className="stats-grid">
            <article className="metric-tile">
              <p className="text-xs uppercase tracking-wide text-slate-500">Loading...</p>
              <div className="mt-1 h-8 w-16 animate-pulse rounded bg-slate-200"></div>
            </article>
            <article className="metric-tile">
              <p className="text-xs uppercase tracking-wide text-slate-500">Loading...</p>
              <div className="mt-1 h-8 w-16 animate-pulse rounded bg-slate-200"></div>
            </article>
            <article className="metric-tile">
              <p className="text-xs uppercase tracking-wide text-slate-500">Loading...</p>
              <div className="mt-1 h-8 w-16 animate-pulse rounded bg-slate-200"></div>
            </article>
            <article className="metric-tile">
              <p className="text-xs uppercase tracking-wide text-slate-500">Loading...</p>
              <div className="mt-1 h-8 w-16 animate-pulse rounded bg-slate-200"></div>
            </article>
          </div>
        )}
      </article>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="card">
          <h3 className="text-lg font-bold text-slate-950">Event status distribution</h3>
          <p className="mt-1 text-sm text-slate-500">Live distribution across the currently selected operating mode.</p>
          <div className="mt-5 w-full max-w-md">
            <Pie
              data={{
                labels: eventByStatus.map((r) => r._id),
                datasets: [
                  {
                    data: eventByStatus.map((r) => r.count),
                    backgroundColor: ["#34d399", "#f87171", "#94a3b8", "#fbbf24"]
                  }
                ]
              }}
              options={{ plugins: { legend: { position: "bottom" } } }}
            />
          </div>
        </article>
        <article className="card">
          <h3 className="text-lg font-bold text-slate-950">Control notes</h3>
          <div className="mt-4 grid gap-3">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Dominant status</p>
              <p className="mt-2 text-xl font-bold text-slate-950">{dominantStatus}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Wallet exposure</p>
              <p className="mt-2 text-xl font-bold text-slate-950">
                <AnimatedNumber value={metrics?.totalWalletBalance || 0} />
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm leading-6 text-slate-600">
                Treat this page as a fast read on platform health. Deep triage belongs in the events, partners, and operations views.
              </p>
            </article>
          </div>
        </article>
      </div>
    </section>
  );
}
