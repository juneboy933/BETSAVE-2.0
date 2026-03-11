"use client";

import { useCallback, useEffect, useState } from "react";
import AnimatedNumber from "../../components/AnimatedNumber";
import { getAdminToken, request } from "../../lib/api";
import { Pie } from 'react-chartjs-2';
import Chart from 'chart.js/auto';

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
      <article className="card">
        <h3 className="mb-2 text-base font-bold">Event Status Distribution</h3>
        <div className="w-full max-w-md">
          <Pie
            data={{
              labels: eventByStatus.map((r) => r._id),
              datasets: [
                {
                  data: eventByStatus.map((r) => r.count),
                  backgroundColor: ['#34d399','#f87171','#a1a1aa']
                }
              ]
            }}
            options={{ plugins: { legend: { position: 'bottom' } } }}
          />
        </div>
      </article>
    </section>
  );
}
