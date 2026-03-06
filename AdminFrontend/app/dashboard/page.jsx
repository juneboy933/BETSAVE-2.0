"use client";

import { useCallback, useEffect, useState } from "react";
import AnimatedNumber from "../../components/AnimatedNumber";
import { getAdminToken, request } from "../../lib/api";

export default function AdminDashboardOverview() {
  const [metrics, setMetrics] = useState(null);
  const [eventByStatus, setEventByStatus] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await request("/api/v1/dashboard/admin/overview", {
        headers: { "x-admin-token": getAdminToken() }
      });
      setMetrics(data.metrics || null);
      setEventByStatus(data.eventByStatus || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const intervalId = setInterval(load, 10000);
    return () => {
      clearInterval(intervalId);
    };
  }, [load]);

  useEffect(() => {
    const onAdminModeChanged = () => {
      load();
    };
    window.addEventListener("admin-mode-changed", onAdminModeChanged);
    return () => window.removeEventListener("admin-mode-changed", onAdminModeChanged);
  }, [load]);

  return (
    <section className="space-y-4">
      <article className="card">
        <div className="section-head">
          <h2 className="text-lg font-bold">Platform Metrics</h2>
          <button className="btn" onClick={load}>
            Refresh
          </button>
        </div>
        {error && <p className="mb-2 text-sm font-semibold text-red-700">{error}</p>}
        {metrics && (
          <div className="stats-grid">
            <article className="metric-tile">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Users</p>
              <p className="mt-1 text-2xl font-bold text-slate-900"><AnimatedNumber value={metrics.totalUsers || 0} /></p>
            </article>
            <article className="metric-tile">
              <p className="text-xs uppercase tracking-wide text-slate-500">Active Partners</p>
              <p className="mt-1 text-2xl font-bold text-slate-900"><AnimatedNumber value={metrics.activePartners || 0} /></p>
            </article>
            <article className="metric-tile">
              <p className="text-xs uppercase tracking-wide text-slate-500">Processed Events</p>
              <p className="mt-1 text-2xl font-bold text-slate-900"><AnimatedNumber value={metrics.totalEvents || 0} /></p>
            </article>
            <article className="metric-tile">
              <p className="text-xs uppercase tracking-wide text-slate-500">Savings Ledger Total</p>
              <p className="mt-1 text-2xl font-bold text-slate-900"><AnimatedNumber value={metrics.totalSavingsLedger || 0} /></p>
            </article>
          </div>
        )}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {metrics &&
                Object.entries(metrics).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{String(v)}</td>
                  </tr>
                ))}
              {!metrics && (
                <tr>
                  <td colSpan={2} className="text-center text-slate-500">
                    No metrics loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
      <article className="card">
        <h3 className="mb-2 text-base font-bold">Event Status Distribution</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {eventByStatus.map((row) => (
                <tr key={row._id}>
                  <td>{row._id}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
              {eventByStatus.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center text-slate-500">
                    No event status data loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
