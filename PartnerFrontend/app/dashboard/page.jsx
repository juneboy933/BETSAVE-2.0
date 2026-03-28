"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
import AnimatedNumber from "../../components/AnimatedNumber";
import { partnerRequest } from "../../lib/api";
import { attachVisiblePolling } from "../../lib/polling";
import { Pie } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

const getStatusChartColor = (status) => {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PROCESSED") return "#22c55e";
  if (normalized === "FAILED") return "#ef4444";
  if (normalized === "PROCESSING") return "#f59e0b";
  if (normalized === "PENDING") return "#94a3b8";
  return "#64748b";
};

export default function PartnerDashboardOverview() {
  const [rows, setRows] = useState([]);
  const [statusSummary, setStatusSummary] = useState([]);
  const [analytics, setAnalytics] = useState({ totalWalletBalance: 0, totalProcessedAmount: 0, totalSavings: 0 });
  const [error, setError] = useState("");
  const statusClass = (status) => {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "PROCESSED") return "bg-emerald-50 text-emerald-800 font-semibold";
    if (normalized === "FAILED") return "bg-rose-50 text-rose-700 font-semibold";
    return "bg-slate-100 text-slate-700 font-semibold";
  };

  const load = useCallback(async () => {
    try {
      setError("");
      const [eventData, analyticsData] = await Promise.all([
        partnerRequest("/api/v1/dashboard/partner/events?page=1&limit=8"),
        partnerRequest("/api/v1/dashboard/partner/analytics")
      ]);
      const events = eventData.events || [];
      const summary = (analyticsData.stat || []).map((item) => ({
        status: item._id || "UNKNOWN",
        count: Number(item.count) || 0
      }));
      setRows(events);
      setStatusSummary(summary);
      setAnalytics({
        totalWalletBalance: Number(analyticsData.totalWalletBalance) || 0,
        totalProcessedAmount: Number(analyticsData.totalProcessedAmount) || 0,
        totalSavings: Number(analyticsData.totalSavings) || 0
      });
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    return attachVisiblePolling(load);
  }, [load]);

  useEffect(() => {
    const onPartnerModeChanged = () => {
      load();
    };
    window.addEventListener("partner-mode-changed", onPartnerModeChanged);
    return () => window.removeEventListener("partner-mode-changed", onPartnerModeChanged);
  }, [load]);

  const processedInView = useMemo(
    () => rows.filter((item) => String(item.status || "").toUpperCase() === "PROCESSED").length,
    [rows]
  );
  const failedInView = useMemo(
    () => rows.filter((item) => String(item.status || "").toUpperCase() === "FAILED").length,
    [rows]
  );

  return (
    <section className="space-y-4">
      <article className="card">
        <div className="section-head">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Overview</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Operational snapshot</h2>
          </div>
          <button className="btn" onClick={load}>
            Refresh
          </button>
        </div>
        <div className="stats-grid">
          <article className="metric-tile">
            <p className="text-xs uppercase tracking-wide text-slate-500">Attributed wallet balance</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              <AnimatedNumber value={analytics.totalWalletBalance} />
            </p>
          </article>
          <article className="metric-tile">
            <p className="text-xs uppercase tracking-wide text-slate-500">Processed event amount</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              <AnimatedNumber value={analytics.totalProcessedAmount} />
            </p>
          </article>
          <article className="metric-tile">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total savings</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              <AnimatedNumber value={analytics.totalSavings} />
            </p>
          </article>
          <article className="metric-tile">
            <p className="text-xs uppercase tracking-wide text-slate-500">Events in focus</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              <AnimatedNumber value={rows.length} />
            </p>
          </article>
        </div>
      </article>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <article className="card">
          <div className="section-head">
            <div>
              <h3 className="text-lg font-bold text-slate-950">Recent partner events</h3>
              <p className="text-sm text-slate-500">Latest platform activity pulled from the dashboard API.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Auto-refresh 30s
            </span>
          </div>
          {error ? <p className="mb-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Savings</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td className="mono text-xs">{row.eventId}</td>
                    <td>{row.phone}</td>
                    <td className={statusClass(row.status)}>{row.status}</td>
                    <td>{Number(row.amount) || 0}</td>
                    <td>{Number(row.savingsAmount) || 0}</td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-500">
                      No events loaded.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <h3 className="text-lg font-bold text-slate-950">Status mix</h3>
          <p className="mt-1 text-sm text-slate-500">Current distribution of partner event outcomes.</p>
          <div className="mt-5 grid gap-4">
            <div className="mx-auto w-full max-w-sm">
              <Pie
                data={{
                  labels: statusSummary.map((item) => item.status),
                  datasets: [
                    {
                      data: statusSummary.map((item) => item.count),
                      backgroundColor: statusSummary.map((item) => getStatusChartColor(item.status))
                    }
                  ]
                }}
                options={{ plugins: { legend: { position: "bottom" } } }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Processed in focus</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  <AnimatedNumber value={processedInView} />
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Failed in focus</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  <AnimatedNumber value={failedInView} />
                </p>
              </article>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
