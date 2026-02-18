"use client";

import { useState } from "react";
import { getAdminToken, request } from "../../lib/api";

export default function OperationsPage() {
  const [ops, setOps] = useState(null);
  const [error, setError] = useState("");

  const loadOperations = async () => {
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

  return (
    <section className="space-y-4">
      <article className="card">
        <h2 className="mb-2 text-lg font-bold">Operational Readiness</h2>
        <button className="btn" onClick={loadOperations}>
          Load Operations
        </button>
        {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
      </article>

      {ops && (
        <>
          <article className="card">
            <h3 className="mb-2 text-base font-bold">Current Operations</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ops.operations || {}).map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card">
            <h3 className="mb-2 text-base font-bold">Financial Integration Readiness</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Check</th>
                    <th>Ready</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ops.integrationReadiness || {}).map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}
    </section>
  );
}
