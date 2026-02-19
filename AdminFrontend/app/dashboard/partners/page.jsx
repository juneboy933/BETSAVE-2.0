"use client";

import { useEffect, useState } from "react";
import { getAdminToken, request } from "../../../lib/api";

export default function AdminDashboardPartners() {
  const [partners, setPartners] = useState([]);
  const [form, setForm] = useState({ partnerId: "", status: "SUSPENDED" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
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

  const update = async () => {
    try {
      setError("");
      const result = await request(`/api/v1/dashboard/admin/partners/${form.partnerId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": getAdminToken() },
        body: JSON.stringify({ status: form.status })
      });
      setMessage(`Updated ${result.partner.name} to ${result.partner.status}`);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const quickUpdate = async (partnerId, status) => {
    setForm({ partnerId, status });
    try {
      setError("");
      const result = await request(`/api/v1/dashboard/admin/partners/${partnerId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": getAdminToken() },
        body: JSON.stringify({ status })
      });
      setMessage(`Updated ${result.partner.name} to ${result.partner.status}`);
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
      <h2 className="text-lg font-bold">Partner Governance</h2>
      <div className="grid gap-2 md:grid-cols-[1fr_220px_auto_auto]">
        <input className="input" placeholder="Partner ID" value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })} />
        <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="ACTIVE">ACTIVE</option>
        </select>
        <button className="btn" onClick={update}>
          Update
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
              <th>Partner ID</th>
              <th>Name</th>
              <th>Status</th>
              <th>Webhook</th>
              <th>Total Events</th>
              <th>Total Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p._id}>
                <td className="font-mono text-xs">{p._id}</td>
                <td>{p.name}</td>
                <td>{p.status}</td>
                <td>{p.webhookUrl || "-"}</td>
                <td>{p.stats?.totalEvents || 0}</td>
                <td>{p.stats?.totalAmount || 0}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary" onClick={() => quickUpdate(p._id, "ACTIVE")}>
                      Activate
                    </button>
                    <button className="btn" onClick={() => quickUpdate(p._id, "SUSPENDED")}>
                      Suspend
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {partners.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-500">
                  No partners loaded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
