"use client";

import { useState } from "react";
import { getAdminToken, request } from "../../lib/api";

export default function PartnersPage() {
  const [partners, setPartners] = useState([]);
  const [action, setAction] = useState({ partnerId: "", status: "SUSPENDED" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPartners = async () => {
    try {
      setError("");
      const data = await request("/api/v1/dashboard/admin/partners?page=1&limit=100", {
        headers: { "x-admin-token": getAdminToken() }
      });
      setPartners(data.partners || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const updateStatus = async () => {
    try {
      setError("");
      const result = await request(`/api/v1/dashboard/admin/partners/${action.partnerId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getAdminToken()
        },
        body: JSON.stringify({ status: action.status })
      });
      setMessage(`Updated: ${result.partner.name} -> ${result.partner.status}`);
      await loadPartners();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="space-y-4">
      <article className="card">
        <h2 className="mb-3 text-lg font-bold">Partner Management</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto_auto]">
          <input
            className="input"
            placeholder="Partner ID"
            value={action.partnerId}
            onChange={(e) => setAction({ ...action, partnerId: e.target.value })}
          />
          <select className="input" value={action.status} onChange={(e) => setAction({ ...action, status: e.target.value })}>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="ACTIVE">ACTIVE</option>
          </select>
          <button className="btn" onClick={updateStatus}>
            Update Status
          </button>
          <button className="btn-secondary" onClick={loadPartners}>
            Refresh
          </button>
        </div>
        {message && <p className="mt-2 text-sm font-semibold text-emerald-700">{message}</p>}
        {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
      </article>

      <article className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Webhook</th>
                <th>Total Events</th>
                <th>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p._id}>
                  <td>{p.name}</td>
                  <td>{p.status}</td>
                  <td>{p.webhookUrl || "-"}</td>
                  <td>{p.stats?.totalEvents || 0}</td>
                  <td>{p.stats?.totalAmount || 0}</td>
                </tr>
              ))}
              {partners.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-slate-500">
                    No partners loaded.
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
