"use client";

import { useEffect, useState } from "react";
import { getPartnerCreds, signedRequest } from "../../../lib/api";

export default function PartnerDashboardEvents() {
  const [form, setForm] = useState({ eventId: `BET-${Date.now()}`, phone: "", amount: 0, type: "BET_PLACED" });
  const [events, setEvents] = useState([]);
  const [message, setMessage] = useState("");
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

  const refresh = async () => {
    try {
      setError("");
      const creds = getPartnerCreds();
      const data = await signedRequest({
        method: "GET",
        path: "/api/v1/dashboard/partner/events?page=1&limit=100",
        body: {},
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret
      });
      setEvents(data.events || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const send = async () => {
    try {
      setError("");
      const creds = getPartnerCreds();
      const result = await signedRequest({
        method: "POST",
        path: "/api/v1/partners/events",
        body: { ...form, amount: Number(form.amount) },
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret
      });
      setMessage(`Event queued: ${result.eventId}`);
      setForm((prev) => ({ ...prev, eventId: `BET-${Date.now()}` }));
      await refresh();
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
    <article className="card space-y-3">
      <h2 className="text-lg font-bold">Automated Bet Events</h2>
      <div className="grid gap-2 md:grid-cols-2">
        <input className="input" value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })} placeholder="Event ID" />
        <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" />
        <input className="input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount" />
        <input className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Type" />
      </div>
      <div className="flex gap-2">
        <button className="btn" onClick={send}>
          Send Event
        </button>
        <button className="btn-secondary" onClick={refresh}>
          Refresh
        </button>
      </div>
      {message && <p className="text-sm font-semibold text-emerald-700">{message}</p>}
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Event ID</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Savings</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e._id}>
                <td>{e.eventId}</td>
                <td className={statusClass(e.status)}>{e.status}</td>
                <td className={amountClass(e.amount)}>{amountLabel(e.amount)}</td>
                <td className={amountClass(e.savingsAmount)}>{amountLabel(e.savingsAmount)}</td>
                <td>{new Date(e.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {events.length === 0 && (
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
