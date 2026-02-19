"use client";

import { useEffect, useState } from "react";
import { getAdminToken, request } from "../../../lib/api";

export default function AdminDashboardNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setError("");
      const data = await request("/api/v1/dashboard/admin/notifications?page=1&limit=100", {
        headers: { "x-admin-token": getAdminToken() }
      });
      setNotifications(data.notifications || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
    const intervalId = setInterval(load, 10000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <article className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Admin Notifications</h2>
        <button className="btn" onClick={load}>
          Refresh
        </button>
      </div>
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Message</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((item) => (
              <tr key={item._id}>
                <td>{item.title}</td>
                <td>{item.message}</td>
                <td>{item.action}</td>
                <td>{item.actorName || "Admin"}</td>
                <td>{new Date(item.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {notifications.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-500">
                  No notifications loaded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
