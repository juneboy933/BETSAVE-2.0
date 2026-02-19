"use client";

import { useEffect, useState } from "react";
import { getAdminToken, request } from "../../lib/api";

export default function AdminDashboardOverview() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setError("");
      const data = await request("/api/v1/dashboard/admin/overview", {
        headers: { "x-admin-token": getAdminToken() }
      });
      setMetrics(data.metrics || null);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
    const intervalId = setInterval(load, 10000);
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="space-y-4">
      <article className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Platform Metrics</h2>
          <button className="btn" onClick={load}>
            Refresh
          </button>
        </div>
        {error && <p className="mb-2 text-sm font-semibold text-red-700">{error}</p>}
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
    </section>
  );
}
