"use client";

import { useState } from "react";
import { getPartnerCreds, signedRequest } from "../../lib/api";

export default function UsersPage() {
  const [phone, setPhone] = useState("");
  const [usersData, setUsersData] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const registerUser = async () => {
    try {
      const creds = getPartnerCreds();
      setErr("");
      const result = await signedRequest({
        method: "POST",
        path: "/api/v1/partners/users/register",
        body: { phone },
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret
      });
      setMsg(`User registered: ${result.phoneNumber}`);
      setPhone("");
      await loadUsers();
    } catch (error) {
      setErr(error.message);
    }
  };

  const loadUsers = async () => {
    try {
      const creds = getPartnerCreds();
      setErr("");
      const result = await signedRequest({
        method: "GET",
        path: "/api/v1/dashboard/partner/users?page=1&limit=100",
        body: {},
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret
      });
      setUsersData(result.users || []);
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <section className="space-y-4">
      <article className="card">
        <h2 className="mb-3 text-lg font-bold">Partner Users</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input className="input" placeholder="+254700000000" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button className="btn" onClick={registerUser}>
            Register User
          </button>
          <button className="btn-secondary" onClick={loadUsers}>
            Refresh List
          </button>
        </div>
        {msg && <p className="mt-2 text-sm font-semibold text-emerald-700">{msg}</p>}
        {err && <p className="mt-2 text-sm font-semibold text-red-700">{err}</p>}
      </article>

      <article className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Phone</th>
                <th>Source</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {usersData.map((u) => (
                <tr key={u._id}>
                  <td>{u.phoneNumber}</td>
                  <td>{u.source}</td>
                  <td>{u.status}</td>
                  <td>{new Date(u.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {usersData.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
