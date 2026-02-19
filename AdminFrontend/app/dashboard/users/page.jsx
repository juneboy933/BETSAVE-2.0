"use client";

import { useEffect, useState } from "react";
import { getAdminToken, request } from "../../../lib/api";

export default function AdminDashboardUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendForm, setSuspendForm] = useState({
    reason: "",
    includePhoto: false,
    photoUrl: "",
    notifyPartners: true
  });

  const refresh = async () => {
    try {
      setError("");
      const data = await request("/api/v1/dashboard/admin/users?page=1&limit=100", {
        headers: { "x-admin-token": getAdminToken() }
      });
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const openSuspendForm = (user) => {
    setSuspendTarget(user);
    setSuspendForm({
      reason: "",
      includePhoto: false,
      photoUrl: "",
      notifyPartners: true
    });
    setShowSuspendForm(true);
    setError("");
    setMessage("");
  };

  const closeSuspendForm = () => {
    setShowSuspendForm(false);
    setSuspendTarget(null);
  };

  const suspendUser = async () => {
    if (!suspendTarget?._id) return;
    try {
      setError("");
      setMessage("");
      const payload = {
        reason: suspendForm.reason.trim(),
        photoUrl: suspendForm.includePhoto ? suspendForm.photoUrl.trim() : "",
        notifyPartners: suspendForm.notifyPartners
      };
      const result = await request(`/api/v1/dashboard/admin/users/${suspendTarget._id}/suspend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": getAdminToken() },
        body: JSON.stringify(payload)
      });
      setMessage(
        `User ${result.user.phoneNumber} suspended. Notified ${result.notifiedPartners}/${result.partnerCount} partners.`
      );
      closeSuspendForm();
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">All Users</h2>
        <button className="btn" onClick={refresh}>
          Refresh
        </button>
      </div>
      {message && <p className="text-sm font-semibold text-emerald-700">{message}</p>}
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Phone</th>
              <th>Status</th>
              <th>Verified</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.phoneNumber}</td>
                <td>{u.status}</td>
                <td>{String(u.verified)}</td>
                <td>{new Date(u.createdAt).toLocaleString()}</td>
                <td>
                  <button className="btn" onClick={() => openSuspendForm(u)}>
                    Suspend
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-500">
                  No users loaded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showSuspendForm && suspendTarget && (
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-bold">Suspend User</h3>
          <label className="label">User Number</label>
          <input className="input" value={suspendTarget.phoneNumber || ""} readOnly />

          <label className="label">Reason (required)</label>
          <textarea
            className="input min-h-24"
            value={suspendForm.reason}
            onChange={(e) => setSuspendForm({ ...suspendForm, reason: e.target.value })}
            placeholder="State why this user should be suspended"
          />

          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={suspendForm.includePhoto}
              onChange={(e) => setSuspendForm({ ...suspendForm, includePhoto: e.target.checked })}
            />
            Include user photo
          </label>

          {suspendForm.includePhoto && (
            <>
              <label className="label">User Photo URL (optional)</label>
              <input
                className="input"
                value={suspendForm.photoUrl}
                onChange={(e) => setSuspendForm({ ...suspendForm, photoUrl: e.target.value })}
                placeholder="https://..."
              />
            </>
          )}

          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={suspendForm.notifyPartners}
              onChange={(e) => setSuspendForm({ ...suspendForm, notifyPartners: e.target.checked })}
            />
            Notify every betting partner linked to this user
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn" onClick={suspendUser}>
              Suspend
            </button>
            <button className="btn-secondary" onClick={closeSuspendForm}>
              Cancel
            </button>
          </div>
        </article>
      )}
    </article>
  );
}
