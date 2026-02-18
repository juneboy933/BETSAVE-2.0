"use client";

import { useEffect, useState } from "react";
import { getPartnerCreds, signedRequest } from "../../lib/api";

export default function PartnerDashboardOverview() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const statusClass = (status) =>
    status === "PROCESSED"
      ? "bg-emerald-50 text-emerald-800 font-semibold"
      : status === "FAILED"
        ? "bg-red-50 text-red-800 font-semibold"
        : "bg-slate-50 text-slate-700 font-semibold";
  const amountClass = (value) =>
    Number(value) < 0 ? "bg-red-50 text-red-800 font-semibold" : "bg-emerald-50 text-emerald-800 font-semibold";
  const amountLabel = (value) => `${Number(value) >= 0 ? "+" : ""}${Number(value) || 0}`;

  const load = async () => {
    try {
      setError("");
      const creds = getPartnerCreds();
      const data = await signedRequest({
        method: "GET",
        path: "/api/v1/dashboard/partner/events?page=1&limit=20",
        body: {},
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret
      });
      setRows(data.events || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
    const intervalId = setInterval(load, 10000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <article className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Recent Processed Events</h2>
        <button className="btn" onClick={load}>
          Refresh
        </button>
      </div>
      {error && <p className="mb-2 text-sm font-semibold text-red-700">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Event ID</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Savings Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td>{r.eventId}</td>
                <td>{r.phone}</td>
                <td className={statusClass(r.status)}>{r.status}</td>
                <td className={amountClass(r.amount)}>{amountLabel(r.amount)}</td>
                <td className={amountClass(r.savingsAmount)}>{amountLabel(r.savingsAmount)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-500">
                  No events loaded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
