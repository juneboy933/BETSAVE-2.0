"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getAdminToken, request } from "../../../../lib/api";

export default function AdminUserManagePage() {
  const params = useParams();
  const userId = useMemo(() => String(params?.userId || ""), [params]);

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [suspendReason, setSuspendReason] = useState("");
  const [includePhoto, setIncludePhoto] = useState(false);
  const [photoData, setPhotoData] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [notifyPartners, setNotifyPartners] = useState(true);

  const load = async () => {
    if (!userId) return;
    try {
      setError("");
      const response = await request(`/api/v1/dashboard/admin/users/${userId}/savings-breakdown`, {
        headers: { "x-admin-token": getAdminToken() }
      });
      setData(response);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [userId]);

  const onPhotoSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setPhotoData("");
      setPhotoName("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoData(typeof reader.result === "string" ? reader.result : "");
      setPhotoName(file.name);
    };
    reader.onerror = () => {
      setError("Unable to read selected image file.");
      setPhotoData("");
      setPhotoName("");
    };
    reader.readAsDataURL(file);
  };

  const suspendUser = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const result = await request(`/api/v1/dashboard/admin/users/${userId}/suspend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": getAdminToken() },
        body: JSON.stringify({
          reason: suspendReason.trim(),
          photoUrl: includePhoto ? photoData : "",
          notifyPartners
        })
      });
      setMessage(
        `User ${result.user.phoneNumber} suspended. Notified ${result.notifiedPartners}/${result.partnerCount} partners.`
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const activateUser = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const result = await request(`/api/v1/dashboard/admin/users/${userId}/activate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": getAdminToken() },
        body: JSON.stringify({ notifyPartners })
      });
      setMessage(
        `User ${result.user.phoneNumber} activated. Notified ${result.notifiedPartners}/${result.partnerCount} partners.`
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <article className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">User Management</h2>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={load}>
              Refresh
            </button>
            <Link href="/dashboard/users" className="btn-secondary">
              Back To Users
            </Link>
          </div>
        </div>

        {error && <p className="mb-2 text-sm font-semibold text-red-700">{error}</p>}
        {message && <p className="mb-2 text-sm font-semibold text-emerald-700">{message}</p>}

        {data && (
          <>
            <div className="grid gap-2 md:grid-cols-4">
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Phone</p>
                <p className="text-sm font-bold text-slate-900">{data.user?.phoneNumber || "-"}</p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Status</p>
                <p className="text-sm font-bold text-slate-900">{data.user?.status || "-"}</p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Wallet Balance</p>
                <p className="text-sm font-bold text-slate-900">{data.walletBalance || 0}</p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Total Saved</p>
                <p className="text-sm font-bold text-slate-900">{data.totalSaved || 0}</p>
              </article>
            </div>

            <div className="mt-4 table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Total Saved</th>
                    <th>Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.byPartner || []).map((item) => (
                    <tr key={item.partnerName}>
                      <td>{item.partnerName}</td>
                      <td>{item.totalSaved}</td>
                      <td>{item.entries}</td>
                    </tr>
                  ))}
                  {(data.byPartner || []).length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center text-slate-500">
                        No partner savings data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </article>

      <article className="card">
        <h3 className="text-base font-bold">User Actions</h3>

        <label className="label">Suspension Reason (required to suspend)</label>
        <textarea
          className="input min-h-24"
          value={suspendReason}
          onChange={(e) => setSuspendReason(e.target.value)}
          placeholder="State why this user should be suspended"
        />

        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={includePhoto} onChange={(e) => setIncludePhoto(e.target.checked)} />
          Include user photo
        </label>

        {includePhoto && (
          <>
            <label className="label">User Photo (optional)</label>
            <input className="input" type="file" accept="image/*" onChange={onPhotoSelected} />
            {photoName && <p className="mt-2 text-xs text-slate-600">Selected: {photoName}</p>}
            {photoData && (
              <img
                src={photoData}
                alt="Suspension evidence preview"
                className="mt-2 h-24 w-24 rounded-md border border-slate-200 object-cover"
              />
            )}
          </>
        )}

        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={notifyPartners} onChange={(e) => setNotifyPartners(e.target.checked)} />
          Notify every linked betting partner
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn" onClick={suspendUser} disabled={loading || !suspendReason.trim()}>
            Suspend User
          </button>
          <button className="btn-secondary" onClick={activateUser} disabled={loading}>
            Activate User
          </button>
        </div>
      </article>
    </section>
  );
}
