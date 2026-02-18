"use client";

import { useEffect, useState } from "react";
import { getPartnerCreds, signedRequest } from "../../../lib/api";

export default function PartnerDashboardUsers() {
  const [phone, setPhone] = useState("");
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.phoneNumber}</td>
                <td>{u.source}</td>
                <td>{u.status}</td>
                <td>{new Date(u.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {users.length === 0 && (
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
