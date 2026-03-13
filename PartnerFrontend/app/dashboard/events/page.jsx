"use client";

import { useCallback, useEffect, useState } from "react";
import { getPartnerOperatingMode, partnerRequest } from "../../../lib/api";
import { attachVisiblePolling } from "../../../lib/polling";

export default function PartnerDashboardEvents() {
  const [form, setForm] = useState({ eventId: `BET-${Date.now()}`, phone: "", amount: 0, type: "BET_PLACED" });
  const [events, setEvents] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [operatingMode, setOperatingMode] = useState("demo");
  const [filters, setFilters] = useState({ status: "ALL", eventId: "", phone: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const statusClass = (status) =>
    status === "PROCESSED"
      ? "bg-emerald-50 text-emerald-800 font-semibold"
      : status === "FAILED"
        ? "bg-red-50 text-red-800 font-semibold"
        : "bg-slate-50 text-slate-700 font-semibold";
  const amountClass = (value) =>
    Number(value) < 0 ? "bg-red-50 text-red-800 font-semibold" : "bg-emerald-50 text-emerald-800 font-semibold";
  const amountLabel = (value) => `${Number(value) >= 0 ? "+" : ""}${Number(value) || 0}`;

  const refresh = useCallback(async () => {
    try {
      setError("");
      setOperatingMode(getPartnerOperatingMode());
      const data = await partnerRequest(
        `/api/v1/dashboard/partner/events?page=1&limit=100${filters.status !== "ALL" ? `&status=${encodeURIComponent(filters.status)}` : ""}`
      );
      setEvents(data.events || []);
    } catch (err) {
      setError(err.message);
    }
  }, [filters.status]);

  const send = async () => {
    try {
      setError("");
      const result = await partnerRequest("/api/v1/partners/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) })
      });
      setMessage(`Event queued: ${result.eventId}`);
      setForm((prev) => ({ ...prev, eventId: `BET-${Date.now()}` }));
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    return attachVisiblePolling(refresh);
  }, [refresh]);

  useEffect(() => {
    const onPartnerModeChanged = () => {
      setOperatingMode(getPartnerOperatingMode());
      refresh();
    };
    window.addEventListener("partner-mode-changed", onPartnerModeChanged);
    return () => window.removeEventListener("partner-mode-changed", onPartnerModeChanged);
  }, [refresh]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, events.length]);

  const filteredEvents = events
    .filter((event) => {
      if (filters.eventId.trim() && !String(event.eventId || "").toLowerCase().includes(filters.eventId.trim().toLowerCase())) {
        return false;
      }
      if (filters.phone.trim() && !String(event.phone || "").toLowerCase().includes(filters.phone.trim().toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const pagedEvents = filteredEvents.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const processedCount = filteredEvents.filter((event) => event.status === "PROCESSED").length;
  const failedCount = filteredEvents.filter((event) => event.status === "FAILED").length;

  return (
    <article className="card space-y-3">
      <h2 className="text-lg font-bold">Bet Event Stream</h2>
      {operatingMode === "demo" ? (
        <section className="callout">
          Demo composer below can still trigger a real STK push when collection is configured. The resulting payment and ledger records stay demo-scoped, and the user's live spendable wallet balance is not increased.
        </section>
      ) : (
        <section className="callout">
          Live mode is active. Event submissions affect production settlement flow and wallet credits on successful callbacks.
        </section>
      )}
      <div className="stats-grid">
        <article className="metric-tile">
          <p className="text-xs uppercase tracking-wide text-slate-500">Visible Events</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{filteredEvents.length}</p>
        </article>
        <article className="metric-tile">
          <p className="text-xs uppercase tracking-wide text-slate-500">Processed</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{processedCount}</p>
        </article>
        <article className="metric-tile">
          <p className="text-xs uppercase tracking-wide text-slate-500">Failed</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{failedCount}</p>
        </article>
      </div>
      {operatingMode === "demo" ? (
        <>
          <h3 className="text-base font-semibold text-slate-700">Demo Event Composer</h3>
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
        </>
      ) : (
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={refresh}>
            Refresh
          </button>
        </div>
      )}
      <div className="grid gap-2 md:grid-cols-[220px_1fr_1fr]">
        <select
          className="input"
          value={filters.status}
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
        >
          <option value="ALL">All Statuses</option>
          <option value="PROCESSED">PROCESSED</option>
          <option value="RECEIVED">RECEIVED</option>
          <option value="PROCESSING">PROCESSING</option>
          <option value="FAILED">FAILED</option>
        </select>
        <input
          className="input"
          placeholder="Filter by event ID"
          value={filters.eventId}
          onChange={(e) => setFilters((prev) => ({ ...prev, eventId: e.target.value }))}
        />
        <input
          className="input"
          placeholder="Filter by phone"
          value={filters.phone}
          onChange={(e) => setFilters((prev) => ({ ...prev, phone: e.target.value }))}
        />
      </div>
      <p className="text-xs font-medium text-slate-500">
        Showing {filteredEvents.length} of {events.length} events (current entries first).
      </p>
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
            {pagedEvents.map((e) => (
              <tr key={e._id}>
                <td>{e.eventId}</td>
                <td className={statusClass(e.status)}>{e.status}</td>
                <td className={amountClass(e.amount)}>{amountLabel(e.amount)}</td>
                <td className={amountClass(e.savingsAmount)}>{amountLabel(e.savingsAmount)}</td>
                <td>{new Date(e.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {pagedEvents.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-500">
                  No events loaded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2">
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
  );
}
