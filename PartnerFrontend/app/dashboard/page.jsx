"use client";

import { useEffect, useState } from "react";
import AnimatedNumber from "../../components/AnimatedNumber";
import { getPartnerCreds, setPartnerCreds, signedRequest } from "../../lib/api";

export default function PartnerDashboardOverview() {
  const [rows, setRows] = useState([]);
  const [statusSummary, setStatusSummary] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [credentials, setCredentials] = useState({ apiKey: "", apiSecret: "" });
  const [credentialsMessage, setCredentialsMessage] = useState("");
  const [error, setError] = useState("");
  const [credentialsError, setCredentialsError] = useState("");
  const statusClass = (status) =>
    status === "PROCESSED"
      ? "bg-emerald-50 text-emerald-800 font-semibold"
      : status === "FAILED"
        ? "bg-red-50 text-red-800 font-semibold"
        : "bg-slate-50 text-slate-700 font-semibold";
  const amountClass = (value) =>
    Number(value) < 0 ? "bg-red-50 text-red-800 font-semibold" : "bg-emerald-50 text-emerald-800 font-semibold";
  const amountLabel = (value) => `${Number(value) >= 0 ? "+" : ""}${Number(value) || 0}`;
  const secureStorageNotice =
    "Store your API key and API secret in a backend secret manager and never expose them in browser code.";
  const loginNotice =
    "Keep these credentials safe. You will need the same API Key and API Secret to login again.";

  const load = async () => {
    try {
      setError("");
      const creds = getPartnerCreds();
      const data = await signedRequest({
        method: "GET",
        path: `/api/v1/dashboard/partner/events?page=${currentPage}&limit=10`,
        body: {},
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret
      });
      setRows(data.events || []);
      setTotalRows(Number(data.total) || 0);
      const summary = (data.events || []).reduce((acc, item) => {
        const key = String(item.status || "UNKNOWN").toUpperCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      setStatusSummary(Object.entries(summary).map(([status, count]) => ({ status, count })));
    } catch (err) {
      setError(err.message);
    }
  };

  const loadCredentials = async () => {
    try {
      setCredentialsError("");
      const creds = getPartnerCreds();
      const data = await signedRequest({
        method: "GET",
        path: "/api/v1/partners/credentials",
        body: {},
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret
      });
      const next = {
        apiKey: data.credentials?.apiKey || "",
        apiSecret: data.credentials?.apiSecret || ""
      };
      setCredentials(next);
      setPartnerCreds(next);
      setCredentialsMessage(data.securityNotice || secureStorageNotice);
    } catch (err) {
      setCredentialsError(err.message);
    }
  };

  useEffect(() => {
    const storedCreds = getPartnerCreds();
    setCredentials(storedCreds);
    const pendingNotice = sessionStorage.getItem("partner_security_notice");
    if (pendingNotice) {
      setCredentialsMessage(pendingNotice);
      sessionStorage.removeItem("partner_security_notice");
    }
    load();
    const intervalId = setInterval(load, 10000);
    return () => {
      clearInterval(intervalId);
    };
  }, [currentPage]);

  const totalPages = Math.max(1, Math.ceil(totalRows / 10));

  return (
    <article className="card space-y-4">
      <section className="callout">
        Partner dashboards support manual controls for demos. In live mode, event and user writes are restricted to
        server-to-server integrations.
      </section>

      <div className="section-head">
        <h2 className="text-lg font-bold">Recent Partner Events</h2>
        <button className="btn" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="stats-grid">
        <article className="metric-tile">
          <p className="text-xs uppercase tracking-wide text-slate-500">Loaded Rows</p>
          <p className="mt-1 text-2xl font-bold text-slate-900"><AnimatedNumber value={rows.length} /></p>
        </article>
        <article className="metric-tile">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Event Rows</p>
          <p className="mt-1 text-2xl font-bold text-slate-900"><AnimatedNumber value={totalRows} /></p>
        </article>
        <article className="metric-tile">
          <p className="text-xs uppercase tracking-wide text-slate-500">Processed In View</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            <AnimatedNumber value={statusSummary.find((item) => item.status === "PROCESSED")?.count || 0} />
          </p>
        </article>
        <article className="metric-tile">
          <p className="text-xs uppercase tracking-wide text-slate-500">Failed In View</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            <AnimatedNumber value={statusSummary.find((item) => item.status === "FAILED")?.count || 0} />
          </p>
        </article>
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

      <article className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <div className="section-head">
          <h3 className="text-base font-bold text-amber-900">Partner API Credentials</h3>
          <button className="btn-secondary" onClick={loadCredentials}>
            Load Credentials
          </button>
        </div>
        <p className="mb-2 text-sm font-bold text-amber-900">{loginNotice}</p>
        <p className="mb-3 text-sm font-semibold text-amber-900">
          {credentialsMessage || secureStorageNotice}
        </p>
        <label className="label">API Key</label>
        <input className="input" value={credentials.apiKey} readOnly />
        <label className="label">API Secret</label>
        <input className="input" value={credentials.apiSecret} readOnly />
        {credentialsError && <p className="mt-2 text-sm font-semibold text-red-700">{credentialsError}</p>}
      </article>
    </article>
  );
}
