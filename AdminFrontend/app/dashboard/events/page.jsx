"use client";

import { useEffect, useState } from "react";
import { getAdminToken, request } from "../../../lib/api";

export default function AdminDashboardEvents() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "ALL", partner: "", phone: "" });
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
      const params = new URLSearchParams({ page: "1", limit: "100" });
      if (filters.status !== "ALL") params.set("status", filters.status);
      if (filters.partner.trim()) params.set("partnerName", filters.partner.trim());
      if (filters.phone.trim()) params.set("phone", filters.phone.trim());

      const data = await request(`/api/v1/dashboard/admin/events?${params.toString()}`, {
        headers: { "x-admin-token": getAdminToken() }
      });
      setEvents(data.events || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    refresh();
    const intervalId = setInterval(refresh, 10000);
    return () => clearInterval(intervalId);
  }, [filters.status, filters.partner, filters.phone]);

  return (
    <article className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">All Events</h2>
        <button className="btn" onClick={refresh}>
          Refresh
        </button>
      </div>
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
          placeholder="Filter by partner name"
          value={filters.partner}
          onChange={(e) => setFilters((prev) => ({ ...prev, partner: e.target.value }))}
        />
        <input
          className="input"
          placeholder="Filter by phone"
          value={filters.phone}
          onChange={(e) => setFilters((prev) => ({ ...prev, phone: e.target.value }))}
        />
      </div>
      <p className="text-xs font-medium text-slate-500">
        Showing {events.length} events (current entries first).
      </p>
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Event ID</th>
              <th>Partner</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Savings Amount</th>
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
                <td className={amountClass(e.savingsAmount)}>{amountLabel(e.savingsAmount)}</td>
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
  );
}
