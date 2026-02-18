"use client";

import { useState } from "react";
import { getPartnerCreds, signedRequest } from "../../lib/api";

export default function AnalyticsPage() {
  const [stats, setStats] = useState([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [behavior, setBehavior] = useState([]);
  const [err, setErr] = useState("");
  const amountClass = (value) =>
    Number(value) < 0 ? "bg-red-50 text-red-800 font-semibold" : "bg-emerald-50 text-emerald-800 font-semibold";
  const amountLabel = (value) => `${Number(value) >= 0 ? "+" : ""}${Number(value) || 0}`;

  const loadAnalytics = async () => {
    try {
      const creds = getPartnerCreds();
      setErr("");
      const [a, b] = await Promise.all([
        signedRequest({
          method: "GET",
          path: "/api/v1/dashboard/partner/analytics",
          body: {},
          apiKey: creds.apiKey,
          apiSecret: creds.apiSecret
        }),
        signedRequest({
          method: "GET",
          path: "/api/v1/dashboard/partner/savings-behavior",
          body: {},
          apiKey: creds.apiKey,
          apiSecret: creds.apiSecret
        })
      ]);
      setStats(a.stat || []);
      setTotalSavings(a.totalSavings || 0);
      setBehavior(b.users || []);
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <section className="space-y-4">
      <article className="card">
        <h2 className="mb-3 text-lg font-bold">Partner Savings Analytics</h2>
        <button className="btn" onClick={loadAnalytics}>
          Load Analytics
        </button>
        {err && <p className="mt-2 text-sm font-semibold text-red-700">{err}</p>}
      </article>

      <article className="card">
        <h3 className="mb-3 text-base font-bold">Event Processing Summary</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Count</th>
                <th>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s._id}>
                  <td>{s._id}</td>
                  <td>{s.count}</td>
                  <td className={amountClass(s.totalAmount)}>{amountLabel(s.totalAmount)}</td>
                </tr>
              ))}
              <tr>
                <td className="font-semibold">Total Savings</td>
                <td>-</td>
                <td className={amountClass(totalSavings)}>{amountLabel(totalSavings)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3 className="mb-3 text-base font-bold">User Savings Behavior</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Phone</th>
                <th>Total Saved</th>
                <th>Savings Events</th>
                <th>Last Saved At</th>
              </tr>
            </thead>
            <tbody>
              {behavior.map((u) => (
                <tr key={u.userId}>
                  <td>{u.phoneNumber || "-"}</td>
                  <td className={amountClass(u.totalSaved)}>{amountLabel(u.totalSaved)}</td>
                  <td>{u.savingsEvents}</td>
                  <td>{new Date(u.lastSavedAt).toLocaleString()}</td>
                </tr>
              ))}
              {behavior.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-slate-500">
                    No behavior data loaded.
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
