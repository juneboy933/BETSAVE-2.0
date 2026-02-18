"use client";

import { useEffect, useState } from "react";
import { getAdminToken, request } from "../../../lib/api";

export default function AdminDashboardOperations() {
  const [ops, setOps] = useState(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      setError("");
      const data = await request("/api/v1/dashboard/admin/operations", {
        headers: { "x-admin-token": getAdminToken() }
      });
      setOps(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    refresh();
    const intervalId = setInterval(refresh, 10000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <section className="space-y-4">
      <article className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Operations Readiness</h2>
          <button className="btn" onClick={refresh}>
            Refresh
          </button>
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
      </article>

      <article className="card">
        <h3 className="mb-2 text-base font-bold">Operations Metrics</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {ops &&
                Object.entries(ops.operations || {}).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{String(v)}</td>
                  </tr>
                ))}
              {!ops && (
                <tr>
                  <td colSpan={2} className="text-center text-slate-500">
                    No operations data loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3 className="mb-2 text-base font-bold">Integration Readiness</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Check</th>
                <th>Ready</th>
              </tr>
            </thead>
            <tbody>
              {ops &&
                Object.entries(ops.integrationReadiness || {}).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{String(v)}</td>
                  </tr>
                ))}
              {!ops && (
                <tr>
                  <td colSpan={2} className="text-center text-slate-500">
                    No readiness data loaded.
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
