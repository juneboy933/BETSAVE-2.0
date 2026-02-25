"use client";

import { useEffect, useMemo, useState } from "react";
import { getPartnerCreds, signedRequest } from "../../../lib/api";

export default function PartnerDashboardUsers() {
  const [phone, setPhone] = useState("");
  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ phone: "", status: "ALL", source: "ALL" });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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
        const statusRank = (value) => ({ VERIFIED: 0, ACTIVE: 1, PENDING: 2, SUSPENDED: 3 }[value] ?? 9);
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

  const registerUser = async (autoSavingsEnabled) => {
    try {
      setError("");
      setMessage("");
      const creds = getPartnerCreds();
      const result = await signedRequest({
        method: "POST",
        path: "/api/v1/partners/users/register",
        body: { phone, autoSavingsEnabled },
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret
      });

      if (result.requiresOtp) {
        setOtpPhone(result.phoneNumber || phone);
        setMessage("OTP request accepted. Ask the user to enter OTP below to complete verification.");
      } else {
        setMessage(
          autoSavingsEnabled
            ? "Auto-savings enabled for user."
            : "User registered without auto-savings."
        );
      }
      setPhone("");
      await loadUsers();
    } catch (err) {
      const providerDetails = err.providerResponse ? ` | provider: ${JSON.stringify(err.providerResponse)}` : "";
      setError(`${err.code ? `[${err.code}] ` : ""}${err.message}${err.details ? ` | details: ${err.details}` : ""}${providerDetails}`);
    }
  };

  const verifyUserOtp = async () => {
    try {
      setError("");
      setMessage("");
      const creds = getPartnerCreds();
      const result = await signedRequest({
        method: "POST",
        path: "/api/v1/partners/users/verify-otp",
        body: { phone: otpPhone, otp: otpCode },
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret
      });
      setMessage(
        `OTP verified. ${result.partnerUser?.phoneNumber || otpPhone} is now ${result.partnerUser?.status || "VERIFIED"}.`
      );
      setOtpCode("");
      await loadUsers();
    } catch (err) {
      const providerDetails = err.providerResponse ? ` | provider: ${JSON.stringify(err.providerResponse)}` : "";
      setError(`${err.code ? `[${err.code}] ` : ""}${err.message}${err.details ? ` | details: ${err.details}` : ""}${providerDetails}`);
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
      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254700000000" />
        <button className="btn" onClick={() => registerUser(true)}>
          Enable Auto-Savings
        </button>
        <button className="btn-secondary" onClick={() => registerUser(false)}>
          Register Manual
        </button>
        <button className="btn-secondary" onClick={loadUsers}>
          Refresh
        </button>
      </div>
      <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr_auto]">
        <input className="input" value={otpPhone} onChange={(e) => setOtpPhone(e.target.value)} placeholder="OTP phone (+254...)" />
        <input className="input" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="4-digit OTP" />
        <button className="btn" onClick={verifyUserOtp}>
          Verify OTP
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
          <option value="PENDING">PENDING</option>
          <option value="VERIFIED">VERIFIED</option>
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
              <th>Auto-Savings</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {pagedUsers.map((u) => (
              <tr key={u._id}>
                <td>{u.phoneNumber}</td>
                <td>{u.source}</td>
                <td>{u.status}</td>
                <td>{u.autoSavingsEnabled ? "ON" : "OFF"}</td>
                <td>{new Date(u.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {pagedUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-500">
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
    </article>
  );
}
