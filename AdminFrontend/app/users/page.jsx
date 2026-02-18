"use client";

import { useState } from "react";
import { getAdminToken, request } from "../../lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  const loadUsers = async () => {
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

  return (
    <section className="space-y-4">
      <article className="card">
        <h2 className="mb-2 text-lg font-bold">Registered Users</h2>
        <button className="btn" onClick={loadUsers}>
          Load Users
        </button>
        {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
      </article>

      <article className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Phone Number</th>
                <th>Status</th>
                <th>Verified</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>{u.phoneNumber}</td>
                  <td>{u.status}</td>
                  <td>{String(u.verified)}</td>
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
    </section>
  );
}
