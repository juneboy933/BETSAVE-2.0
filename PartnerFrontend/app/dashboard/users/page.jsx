"use client";

import { useEffect, useMemo, useState } from "react";
import { getPartnerCreds, signedRequest } from "../../../lib/api";

export default function PartnerDashboardUsers() {
  const [phone, setPhone] = useState("");
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ phone: "", status: "ALL", source: "ALL" });

  const filteredUsers = useMemo(() => {
    const phoneNeedle = filters.phone.trim().toLowerCase();
    return [...users]
      .filter((user) => {
        if (filters.status !== "ALL" && user.status !== filters.status) return false;
        if (filters.source !== "ALL" && user.source !== filters.source) return false;
        if (phoneNeedle && !String(user.phoneNumber || "").toLowerCase().includes(phoneNeedle)) return false;
        return true;
      })
      .sort((a, b) => {
        const statusRank = (value) => (value === "ACTIVE" ? 0 : 1);
        const statusDelta = statusRank(a.status) - statusRank(b.status);
        if (statusDelta !== 0) return statusDelta;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [users, filters]);

  const loadUsers = async () => {
    try {
      setError("");
      const creds = getPartnerCreds();
      const data = await signedRequest({
        method: "GET",
        path: "/api/v1/dashboard/partner/users?page=1&limit=100",
        body: {},
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret
      });
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const registerUser = async () => {
    try {
      setError("");
      const creds = getPartnerCreds();
      await signedRequest({
        method: "POST",
        path: "/api/v1/partners/users/register",
        body: { phone },
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret
      });
      setMessage("User registered.");
      setPhone("");
      await loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadUsers();
    const intervalId = setInterval(loadUsers, 10000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <article className="card space-y-3">
      <h2 className="text-lg font-bold">Partner Users</h2>
      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254700000000" />
        <button className="btn" onClick={registerUser}>
          Register User
        </button>
        <button className="btn-secondary" onClick={loadUsers}>
          Refresh
        </button>
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_220px_220px]">
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
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
        <select
          className="input"
          value={filters.source}
          onChange={(e) => setFilters((prev) => ({ ...prev, source: e.target.value }))}
        >
          <option value="ALL">All Sources</option>
          <option value="REGISTERED">REGISTERED</option>
          <option value="INFERRED">INFERRED</option>
        </select>
      </div>
      <p className="text-xs font-medium text-slate-500">
        Showing {filteredUsers.length} of {users.length} users (current entries first).
      </p>
      {message && <p className="text-sm font-semibold text-emerald-700">{message}</p>}
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Phone</th>
              <th>Source</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u._id}>
                <td>{u.phoneNumber}</td>
                <td>{u.source}</td>
                <td>{u.status}</td>
                <td>{new Date(u.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-500">
                  No users loaded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
