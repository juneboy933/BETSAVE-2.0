"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getAdminToken, request } from "../../../../lib/api";

export default function AdminPartnerManagePage() {
  const params = useParams();
  const partnerId = useMemo(() => String(params?.partnerId || ""), [params]);

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!partnerId) return;
    try {
      setError("");
      const response = await request(`/api/v1/dashboard/admin/partners/${partnerId}/details`, {
        headers: { "x-admin-token": getAdminToken() }
      });
      setData(response);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [partnerId]);

  const updateStatus = async (status) => {
    if (!partnerId) return;
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const result = await request(`/api/v1/dashboard/admin/partners/${partnerId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": getAdminToken() },
        body: JSON.stringify({ status })
      });
      setMessage(`Partner ${result.partner.name} updated to ${result.partner.status}.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusCounts = (data?.stats || []).reduce((acc, item) => {
    acc[item._id] = item.count || 0;
    return acc;
  }, {});
  const totalAmount = (data?.stats || []).reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);

  return (
    <section className="space-y-4">
      <article className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Partner Management</h2>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={load}>
              Refresh
            </button>
            <Link href="/dashboard/partners" className="btn-secondary">
              Back To Partners
            </Link>
          </div>
        </div>

        {error && <p className="mb-2 text-sm font-semibold text-red-700">{error}</p>}
        {message && <p className="mb-2 text-sm font-semibold text-emerald-700">{message}</p>}

        {data && (
          <>
            <div className="grid gap-2 md:grid-cols-4">
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Partner Name</p>
                <p className="text-sm font-bold text-slate-900">{data.partner?.name || "-"}</p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Status</p>
                <p className="text-sm font-bold text-slate-900">{data.partner?.status || "-"}</p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Linked Users</p>
                <p className="text-sm font-bold text-slate-900">{data.partnerUsers || 0}</p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Total Savings</p>
                <p className="text-sm font-bold text-slate-900">{data.savings?.totalSavings || 0}</p>
              </article>
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-500">Partner ID</p>
              <p className="font-mono text-xs text-slate-900">{data.partner?._id || "-"}</p>
              <p className="mt-2 text-xs uppercase text-slate-500">Webhook URL</p>
              <p className="text-sm text-slate-900">{data.partner?.webhookUrl || "-"}</p>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-4">
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Processed Events</p>
                <p className="text-sm font-bold text-slate-900">{statusCounts.PROCESSED || 0}</p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Failed Events</p>
                <p className="text-sm font-bold text-slate-900">{statusCounts.FAILED || 0}</p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Received Events</p>
                <p className="text-sm font-bold text-slate-900">{statusCounts.RECEIVED || 0}</p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Total Event Amount</p>
                <p className="text-sm font-bold text-slate-900">{totalAmount}</p>
              </article>
            </div>

            <div className="mt-4 table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Event ID</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recentEvents || []).map((event) => (
                    <tr key={event._id}>
                      <td>{event.eventId}</td>
                      <td>{event.phone}</td>
                      <td>{event.status}</td>
                      <td>{event.amount}</td>
                      <td>{new Date(event.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(data.recentEvents || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-500">
                        No events found for this partner.
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
        <h3 className="text-base font-bold">Partner Actions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => updateStatus("ACTIVE")} disabled={loading}>
            Activate Partner
          </button>
          <button className="btn" onClick={() => updateStatus("SUSPENDED")} disabled={loading}>
            Suspend Partner
          </button>
        </div>
      </article>
    </section>
  );
}
