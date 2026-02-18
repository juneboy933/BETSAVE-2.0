"use client";

import { useState } from "react";
import { getPartnerCreds, signedRequest } from "../../lib/api";

export default function EventsPage() {
  const [form, setForm] = useState({ eventId: `BET-${Date.now()}`, phone: "", amount: 0, type: "BET_PLACED" });
  const [events, setEvents] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const statusClass = (status) =>
    status === "PROCESSED"
      ? "bg-emerald-50 text-emerald-800 font-semibold"
      : status === "FAILED"
        ? "bg-red-50 text-red-800 font-semibold"
        : "bg-slate-50 text-slate-700 font-semibold";
  const amountClass = (value) =>
    Number(value) < 0 ? "bg-red-50 text-red-800 font-semibold" : "bg-emerald-50 text-emerald-800 font-semibold";
  const amountLabel = (value) => `${Number(value) >= 0 ? "+" : ""}${Number(value) || 0}`;

  const sendEvent = async () => {
    try {
      const creds = getPartnerCreds();
      setErr("");
      const result = await signedRequest({
        method: "POST",
        path: "/api/v1/partners/events",
        body: { ...form, amount: Number(form.amount) },
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret
      });
      setMsg(`Event accepted: ${result.eventId}`);
      setForm((prev) => ({ ...prev, eventId: `BET-${Date.now()}` }));
      await loadEvents();
    } catch (error) {
      setErr(error.message);
    }
  };

  const loadEvents = async () => {
    try {
      const creds = getPartnerCreds();
      setErr("");
      const data = await signedRequest({
        method: "GET",
        path: "/api/v1/dashboard/partner/events?page=1&limit=100",
        body: {},
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret
      });
      setEvents(data.events || []);
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <section className="space-y-4">
      <article className="card">
        <h2 className="mb-3 text-lg font-bold">Send Automated Bet Event</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Event ID</label>
            <input className="input" value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Amount</label>
            <input
              className="input"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Type</label>
            <input className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn" onClick={sendEvent}>
            Send Event
          </button>
          <button className="btn-secondary" onClick={loadEvents}>
            Refresh Events
          </button>
        </div>
        {msg && <p className="mt-2 text-sm font-semibold text-emerald-700">{msg}</p>}
        {err && <p className="mt-2 text-sm font-semibold text-red-700">{err}</p>}
      </article>

      <article className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Savings Amount</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e._id}>
                  <td>{e.eventId}</td>
                  <td>{e.phone}</td>
                  <td className={statusClass(e.status)}>{e.status}</td>
                  <td className={amountClass(e.amount)}>{amountLabel(e.amount)}</td>
                  <td className={amountClass(e.savingsAmount)}>{amountLabel(e.savingsAmount)}</td>
                  <td>{new Date(e.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-slate-500">
                    No events loaded.
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
