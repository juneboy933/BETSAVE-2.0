"use client";

import { useEffect, useState } from "react";
import { getPartnerCreds, signedRequest } from "../../../lib/api";

export default function PartnerDashboardAnalytics() {
  const [summary, setSummary] = useState([]);
  const [totalWalletBalance, setTotalWalletBalance] = useState(0);
  const [totalProcessedAmount, setTotalProcessedAmount] = useState(0);
  const [behavior, setBehavior] = useState([]);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const toPositiveNumber = (value) => Math.max(0, Number(value) || 0);
  const amountClass = (value) =>
    Number(value) < 0 ? "bg-red-50 text-red-800 font-semibold" : "bg-emerald-50 text-emerald-800 font-semibold";
  const amountLabel = (value) => `${Number(value) >= 0 ? "+" : ""}${Number(value) || 0}`;

  const load = async () => {
    try {
      setError("");
      const creds = getPartnerCreds();
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
      setSummary(a.stat || []);
      setTotalWalletBalance(toPositiveNumber(a.totalWalletBalance));
      setTotalProcessedAmount(toPositiveNumber(a.totalProcessedAmount));
      setBehavior(b.users || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
    const intervalId = setInterval(load, 10000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [behavior.length]);

  const totalPages = Math.max(1, Math.ceil(behavior.length / pageSize));
  const pagedBehavior = behavior.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="space-y-4">
      <article className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Savings Analytics</h2>
          <button className="btn" onClick={load}>
            Refresh
          </button>
        </div>
        {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Wallet Balance</p>
            <p className="mt-1 text-2xl font-bold">{totalWalletBalance}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Processed Event Amount</p>
            <p className="mt-1 text-2xl font-bold">{totalProcessedAmount}</p>
          </div>
        </div>
      </article>

      <article className="card">
        <h3 className="mb-2 text-base font-bold">Status Summary</h3>
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
              {summary.map((s) => (
                <tr key={s._id}>
                  <td>{s._id}</td>
                  <td>{s.count}</td>
                  <td className={amountClass(s.totalAmount)}>{amountLabel(s.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3 className="mb-2 text-base font-bold">User Savings Behavior</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Phone</th>
                <th>Total Saved</th>
                <th>Savings Events</th>
                <th>Last Saved</th>
              </tr>
            </thead>
            <tbody>
              {pagedBehavior.map((u) => (
                <tr key={u.userId}>
                  <td>{u.phoneNumber || "-"}</td>
                  <td className={amountClass(u.totalSaved)}>{amountLabel(u.totalSaved)}</td>
                  <td>{u.savingsEvents}</td>
                  <td>{new Date(u.lastSavedAt).toLocaleString()}</td>
                </tr>
              ))}
              {pagedBehavior.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-slate-500">
                    No behavior data loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button className="btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
            Previous
          </button>
          <p className="text-xs font-medium text-slate-500">
            Page {currentPage} of {totalPages}
          </p>
          <button
            className="btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </article>
    </section>
  );
}
