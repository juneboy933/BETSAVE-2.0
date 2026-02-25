"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminToken, request } from "../../../lib/api";

export default function AdminDashboardUsers() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [selectedUserForPartners, setSelectedUserForPartners] = useState(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ phone: "", status: "ALL", partner: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const filteredUsers = useMemo(() => {
    const phoneNeedle = filters.phone.trim().toLowerCase();
    const partnerNeedle = filters.partner.trim().toLowerCase();

    return [...users]
      .filter((user) => {
        if (filters.status !== "ALL" && user.status !== filters.status) return false;
        if (phoneNeedle && !String(user.phoneNumber || "").toLowerCase().includes(phoneNeedle)) return false;
        if (
          partnerNeedle &&
          !(user.partners || []).some((partner) => String(partner).toLowerCase().includes(partnerNeedle))
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const statusRank = (value) => (value === "ACTIVE" ? 0 : value === "PENDING" ? 1 : 2);
        const statusDelta = statusRank(a.status) - statusRank(b.status);
        if (statusDelta !== 0) return statusDelta;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [users, filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, users.length]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pagedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
      <div className="grid gap-2 md:grid-cols-[1fr_220px_1fr]">
        <input
          className="input"
          placeholder="Filter by phone"
          value={filters.phone}
          onChange={(e) => setFilters((prev) => ({ ...prev, phone: e.target.value }))}
        />
        <select
          className="input"
          value={filters.status}
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="PENDING">PENDING</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
        <input
          className="input"
          placeholder="Filter by partner"
          value={filters.partner}
          onChange={(e) => setFilters((prev) => ({ ...prev, partner: e.target.value }))}
        />
      </div>
      <p className="text-xs font-medium text-slate-500">
        Showing {filteredUsers.length} of {users.length} users (current entries first).
      </p>
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
            {pagedUsers.map((u) => (
              <tr key={u._id}>
                <td>{u.phoneNumber}</td>
                <td>{u.status}</td>
                <td>{String(u.verified)}</td>
                <td>
                  <button
                    className="btn-secondary"
                    onClick={() => setSelectedUserForPartners(u)}
                    disabled={!u.partnerMemberships?.length}
                  >
                    {u.partnerMemberships?.length
                      ? `View Partners (${u.partnerCount || u.partnerMemberships.length})`
                      : "No Partners"}
                  </button>
                </td>
                <td>{new Date(u.createdAt).toLocaleString()}</td>
                <td>
                  <button className="btn" onClick={() => router.push(`/dashboard/users/${u._id}`)}>
                    Manage
                  </button>
                </td>
              </tr>
            ))}
            {pagedUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-500">
                  No users loaded.
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

      {selectedUserForPartners && (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <article className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">User Partner Memberships</h3>
                <p className="text-sm text-slate-600">{selectedUserForPartners.phoneNumber}</p>
              </div>
              <button className="btn-secondary" onClick={() => setSelectedUserForPartners(null)}>
                Close
              </button>
            </div>

            {selectedUserForPartners.partnerMemberships?.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Partner</th>
                      <th>Status</th>
                      <th>Source</th>
                      <th>Auto-Savings</th>
                      <th>Linked At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUserForPartners.partnerMemberships.map((membership) => (
                      <tr key={`${selectedUserForPartners._id}-${membership.name}`}>
                        <td>{membership.name}</td>
                        <td>{membership.status}</td>
                        <td>{membership.source}</td>
                        <td>{membership.autoSavingsEnabled ? "ON" : "OFF"}</td>
                        <td>{membership.linkedAt ? new Date(membership.linkedAt).toLocaleString() : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No partner memberships found for this user.</p>
            )}
          </article>
        </section>
      )}
    </article>
  );
}
