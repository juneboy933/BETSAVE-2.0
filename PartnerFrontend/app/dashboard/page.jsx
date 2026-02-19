"use client";

import { useEffect, useState } from "react";
import { getPartnerCreds, setPartnerCreds, signedRequest } from "../../lib/api";

export default function PartnerDashboardOverview() {
  const [rows, setRows] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [credentials, setCredentials] = useState({ apiKey: "", apiSecret: "" });
  const [credentialsMessage, setCredentialsMessage] = useState("");
  const [error, setError] = useState("");
  const [notificationsError, setNotificationsError] = useState("");
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

  const loadNotifications = async () => {
    try {
      setNotificationsError("");
      const creds = getPartnerCreds();
      const data = await signedRequest({
        method: "GET",
        path: "/api/v1/dashboard/partner/notifications?page=1&limit=20",
        body: {},
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret
      });
      setNotifications(data.notifications || []);
    } catch (err) {
      setNotificationsError(err.message);
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
    loadNotifications();
    const intervalId = setInterval(load, 10000);
    const notificationsIntervalId = setInterval(loadNotifications, 15000);
    return () => {
      clearInterval(intervalId);
      clearInterval(notificationsIntervalId);
    };
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

      <article className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-amber-900">Partner API Credentials</h3>
          <button className="btn-secondary" onClick={loadCredentials}>
            Load Saved Credentials
          </button>
        </div>
        <p className="mb-3 text-sm font-semibold text-amber-900">
          {credentialsMessage || secureStorageNotice}
        </p>
        <label className="label">API Key</label>
        <input className="input" value={credentials.apiKey} readOnly />
        <label className="label">API Secret</label>
        <input className="input" value={credentials.apiSecret} readOnly />
        {credentialsError && <p className="mt-2 text-sm font-semibold text-red-700">{credentialsError}</p>}
      </article>

      <article className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Admin Notifications</h3>
          <button className="btn-secondary" onClick={loadNotifications}>
            Refresh Notifications
          </button>
        </div>
        {notificationsError && <p className="mb-2 text-sm font-semibold text-red-700">{notificationsError}</p>}
        <div className="space-y-2">
          {notifications.map((item) => (
            <article key={item._id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-900">{item.title}</p>
              <p className="text-sm text-slate-700">{item.message}</p>
              <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
            </article>
          ))}
          {notifications.length === 0 && <p className="text-sm text-slate-500">No notifications yet.</p>}
        </div>
      </article>
    </article>
  );
}
