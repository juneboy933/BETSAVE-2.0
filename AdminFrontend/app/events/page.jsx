"use client";

import { useState } from "react";
import { getAdminToken, request } from "../../lib/api";

export default function EventsPage() {
  const [events, setEvents] = useState([]);
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

  const loadEvents = async () => {
    try {
      setError("");
      const data = await request("/api/v1/dashboard/admin/events?page=1&limit=100", {
        headers: { "x-admin-token": getAdminToken() }
      });
      setEvents(data.events || []);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="space-y-4">
      <article className="card">
        <h2 className="mb-2 text-lg font-bold">All Platform Events</h2>
        <button className="btn" onClick={loadEvents}>
          Load Events
        </button>
        {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
      </article>

      <article className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Partner</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e._id}>
                  <td>{e.eventId}</td>
                  <td>{e.partnerName}</td>
                  <td>{e.phone}</td>
                  <td className={statusClass(e.status)}>{e.status}</td>
                  <td className={amountClass(e.amount)}>{amountLabel(e.amount)}</td>
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
