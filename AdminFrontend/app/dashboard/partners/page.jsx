"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminToken, request } from "../../../lib/api";

export default function AdminDashboardPartners() {
  const router = useRouter();
  const [partners, setPartners] = useState([]);
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

  useEffect(() => {
    refresh();
    const intervalId = setInterval(refresh, 10000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <article className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Partner Governance</h2>
        <button className="btn" onClick={refresh}>
          Refresh
        </button>
      </div>
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
              <th>Action</th>
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
                  <button className="btn" onClick={() => router.push(`/dashboard/partners/${p._id}`)}>
                    Manage
                  </button>
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
