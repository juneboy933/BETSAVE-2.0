"use client";

import { useEffect, useState } from "react";
import { getAdminToken, request } from "../../../lib/api";

export default function AdminDashboardUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [breakdownTarget, setBreakdownTarget] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [breakdownError, setBreakdownError] = useState("");
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendForm, setSuspendForm] = useState({
    reason: "",
    includePhoto: false,
    photoData: "",
    photoName: "",
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
      photoData: "",
      photoName: "",
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

  const openSavingsBreakdown = async (user) => {
    try {
      setBreakdownError("");
      setLoadingBreakdown(true);
      setBreakdownTarget(user);
      const data = await request(`/api/v1/dashboard/admin/users/${user._id}/savings-breakdown`, {
        headers: { "x-admin-token": getAdminToken() }
      });
      setBreakdown(data);
    } catch (err) {
      setBreakdownError(err.message);
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const closeSavingsBreakdown = () => {
    setBreakdownTarget(null);
    setBreakdown(null);
    setBreakdownError("");
    setLoadingBreakdown(false);
  };

  const suspendUser = async () => {
    if (!suspendTarget?._id) return;
    try {
      setError("");
      setMessage("");
      const payload = {
        reason: suspendForm.reason.trim(),
        photoUrl: suspendForm.includePhoto ? suspendForm.photoData : "",
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

  const onPhotoSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSuspendForm((prev) => ({ ...prev, photoData: "", photoName: "" }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSuspendForm((prev) => ({
        ...prev,
        photoData: typeof reader.result === "string" ? reader.result : "",
        photoName: file.name
      }));
    };
    reader.onerror = () => {
      setError("Unable to read selected image file.");
      setSuspendForm((prev) => ({ ...prev, photoData: "", photoName: "" }));
    };
    reader.readAsDataURL(file);
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
              <th>Partners</th>
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
                <td>{u.partners?.length ? u.partners.join(", ") : "-"}</td>
                <td>{new Date(u.createdAt).toLocaleString()}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary" onClick={() => openSavingsBreakdown(u)}>
                      Savings
                    </button>
                    <button className="btn" onClick={() => openSuspendForm(u)}>
                      Suspend
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-500">
                  No users loaded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {breakdownTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <article className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">Savings Breakdown: {breakdownTarget.phoneNumber}</h3>
              <button className="btn-secondary" onClick={closeSavingsBreakdown}>
                Close
              </button>
            </div>

            {loadingBreakdown && <p className="text-sm text-slate-600">Loading savings breakdown...</p>}
            {breakdownError && <p className="text-sm font-semibold text-red-700">{breakdownError}</p>}

            {breakdown && !loadingBreakdown && (
              <section className="space-y-3">
                <div className="grid gap-2 md:grid-cols-3">
                  <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase text-slate-500">Wallet Balance</p>
                    <p className="text-lg font-bold text-slate-900">{breakdown.walletBalance || 0}</p>
                  </article>
                  <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase text-slate-500">Total Saved</p>
                    <p className="text-lg font-bold text-slate-900">{breakdown.totalSaved || 0}</p>
                  </article>
                  <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase text-slate-500">Savings Entries</p>
                    <p className="text-lg font-bold text-slate-900">{breakdown.totalEntries || 0}</p>
                  </article>
                </div>

                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Partner</th>
                        <th>Total Saved</th>
                        <th>Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(breakdown.byPartner || []).map((item) => (
                        <tr key={item.partnerName}>
                          <td>{item.partnerName}</td>
                          <td>{item.totalSaved}</td>
                          <td>{item.entries}</td>
                        </tr>
                      ))}
                      {(breakdown.byPartner || []).length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-center text-slate-500">
                            No partner savings data found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </article>
        </div>
      )}

      {showSuspendForm && suspendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <article className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="text-base font-bold">Suspend User</h3>
            <label className="label">User Number</label>
            <input className="input" value={suspendTarget.phoneNumber || ""} readOnly />

            <label className="label">Reason (required)</label>
            <textarea
              className="input min-h-24"
              value={suspendForm.reason}
              onChange={(e) => setSuspendForm({ ...suspendForm, reason: e.target.value })}
              placeholder="State why this user should be suspended"
              required
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
                <label className="label">User Photo (optional)</label>
                <input className="input" type="file" accept="image/*" onChange={onPhotoSelected} />
                {suspendForm.photoName && <p className="mt-2 text-xs text-slate-600">Selected: {suspendForm.photoName}</p>}
                {suspendForm.photoData && (
                  <img
                    src={suspendForm.photoData}
                    alt="Suspension evidence preview"
                    className="mt-2 h-24 w-24 rounded-md border border-slate-200 object-cover"
                  />
                )}
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
              <button className="btn" onClick={suspendUser} disabled={!suspendForm.reason.trim()}>
                Suspend
              </button>
              <button className="btn-secondary" onClick={closeSuspendForm}>
                Cancel
              </button>
            </div>
          </article>
        </div>
      )}
    </article>
  );
}
