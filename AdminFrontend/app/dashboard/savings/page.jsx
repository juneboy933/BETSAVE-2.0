"use client";

import { useEffect, useState } from "react";
import { getAdminToken, request } from "../../../lib/api";

export default function AdminDashboardSavings() {
  const [summary, setSummary] = useState(null);
  const [byPartner, setByPartner] = useState([]);
  const [error, setError] = useState("");
  const safeAmount = (value) => Math.max(0, Number(value) || 0);
  const amountClass = () => "bg-emerald-50 text-emerald-800 font-semibold";
  const amountLabel = (value) => `+${safeAmount(value)}`;

  const refresh = async () => {
    try {
      setError("");
      const data = await request("/api/v1/dashboard/admin/savings", {
        headers: { "x-admin-token": getAdminToken() }
      });
      setSummary(data.summary || null);
      setByPartner(data.byPartner || []);
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
          <h2 className="text-lg font-bold">Savings View</h2>
          <button className="btn" onClick={refresh}>
            Refresh
          </button>
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
      </article>

      <article className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Total Savings</th>
                <th>Total Entries</th>
              </tr>
            </thead>
            <tbody>
              {summary ? (
                <tr>
                  <td className={amountClass(summary.totalSavings)}>{amountLabel(summary.totalSavings)}</td>
                  <td>{summary.totalEntries}</td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={2} className="text-center text-slate-500">
                    No summary loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3 className="mb-2 text-base font-bold">Savings by Partner</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Total Savings</th>
                <th>Entries</th>
              </tr>
            </thead>
            <tbody>
              {byPartner.map((p) => (
                <tr key={p._id}>
                  <td>{p._id}</td>
                  <td className={amountClass(p.totalSavings)}>{amountLabel(p.totalSavings)}</td>
                  <td>{p.entries}</td>
                </tr>
              ))}
              {byPartner.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-slate-500">
                    No partner data loaded.
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
