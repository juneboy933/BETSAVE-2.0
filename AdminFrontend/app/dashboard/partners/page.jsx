"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminToken, request } from "../../../lib/api";

export default function AdminDashboardPartners() {
  const router = useRouter();
  const [partners, setPartners] = useState([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ name: "", status: "ALL" });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const filteredPartners = useMemo(() => {
    const nameNeedle = filters.name.trim().toLowerCase();
    return [...partners]
      .filter((partner) => {
        if (filters.status !== "ALL" && partner.status !== filters.status) return false;
        if (nameNeedle && !String(partner.name || "").toLowerCase().includes(nameNeedle)) return false;
        return true;
      })
      .sort((a, b) => {
        const statusRank = (value) => (value === "ACTIVE" ? 0 : 1);
        const statusDelta = statusRank(a.status) - statusRank(b.status);
        if (statusDelta !== 0) return statusDelta;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [partners, filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, partners.length]);

  const totalPages = Math.max(1, Math.ceil(filteredPartners.length / pageSize));
  const pagedPartners = filteredPartners.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
      <div className="grid gap-2 md:grid-cols-[1fr_220px]">
        <input
          className="input"
          placeholder="Filter by partner name"
          value={filters.name}
          onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
        />
        <select
          className="input"
          value={filters.status}
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
      </div>
      <p className="text-xs font-medium text-slate-500">
        Showing {filteredPartners.length} of {partners.length} partners (current entries first).
      </p>
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
              <th>Total Savings</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pagedPartners.map((p) => (
              <tr key={p._id}>
                <td className="font-mono text-xs">{p._id}</td>
                <td>{p.name}</td>
                <td>{p.status}</td>
                <td>{p.webhookUrl || "-"}</td>
                <td>{p.stats?.totalEvents || 0}</td>
                <td>{p.stats?.totalAmount || 0}</td>
                <td>{p.stats?.totalSavings || 0}</td>
                <td>
                  <button className="btn" onClick={() => router.push(`/dashboard/partners/${p._id}`)}>
                    Manage
                  </button>
                </td>
              </tr>
            ))}
            {pagedPartners.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-slate-500">
                  No partners loaded.
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
