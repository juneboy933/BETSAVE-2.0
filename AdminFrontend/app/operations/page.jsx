"use client";

import { useState } from "react";
import { request } from "../../lib/api";

const formatLabel = (value) =>
  String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function OperationsPage() {
  const [ops, setOps] = useState(null);
  const [error, setError] = useState("");

  const loadOperations = async () => {
    try {
      setError("");
      const data = await request("/api/v1/dashboard/admin/operations");
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
            <h3 className="mb-2 text-base font-bold">Mode-Scoped Backlog</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ops.operations?.scoped || {}).map(([k, v]) => (
                    <tr key={k}>
                      <td>{formatLabel(k)}</td>
                      <td>{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card">
            <h3 className="mb-2 text-base font-bold">Global Platform Counts</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ops.operations?.global || {}).map(([k, v]) => (
                    <tr key={k}>
                      <td>{formatLabel(k)}</td>
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
