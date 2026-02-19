"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminToken, request } from "../../../lib/api";

export default function AdminDashboardUsers() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

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
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.phoneNumber}</td>
                <td>{u.status}</td>
                <td>{String(u.verified)}</td>
                <td>{u.partners?.length ? u.partners.join(", ") : "-"}</td>
                <td>{new Date(u.createdAt).toLocaleString()}</td>
                <td>
                  <button className="btn" onClick={() => router.push(`/dashboard/users/${u._id}`)}>
                    Manage
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-500">
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
