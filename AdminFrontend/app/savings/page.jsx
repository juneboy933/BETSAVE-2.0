"use client";

import { useState } from "react";
import { getAdminToken, request } from "../../lib/api";

export default function SavingsPage() {
  const [summary, setSummary] = useState(null);
  const [byPartner, setByPartner] = useState([]);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");
  const amountClass = (value) =>
    Number(value) < 0 ? "bg-red-50 text-red-800 font-semibold" : "bg-emerald-50 text-emerald-800 font-semibold";
  const amountLabel = (value) => `${Number(value) >= 0 ? "+" : ""}${Number(value) || 0}`;

  const loadSavings = async () => {
    try {
      setError("");
      const data = await request("/api/v1/dashboard/admin/savings", {
        headers: { "x-admin-token": getAdminToken() }
      });
      setSummary(data.summary || null);
      setByPartner(data.byPartner || []);
      setEntries(data.recentSavingsEntries || []);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="space-y-4">
      <article className="card">
        <h2 className="mb-2 text-lg font-bold">Savings Operations</h2>
        <button className="btn" onClick={loadSavings}>
          Load Savings Data
        </button>
        {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
      </article>

      {summary && (
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
                <tr>
                  <td className={amountClass(summary.totalSavings)}>{amountLabel(summary.totalSavings)}</td>
                  <td>{summary.totalEntries}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      )}

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
                    No partner savings loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3 className="mb-2 text-base font-bold">Recent Savings Entries</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>User ID</th>
                <th>Amount</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e._id}>
                  <td>{e.eventId}</td>
                  <td>{e.userId}</td>
                  <td className={amountClass(e.amount)}>{amountLabel(e.amount)}</td>
                  <td>{new Date(e.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-slate-500">
                    No entries loaded.
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
