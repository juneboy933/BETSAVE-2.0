"use client";

import { useEffect, useState } from "react";
import { getAdminToken, request } from "../../lib/api";

export default function AdminDashboardOverview() {
  const [metrics, setMetrics] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  const [notificationsError, setNotificationsError] = useState("");

  const load = async () => {
    try {
      setError("");
      const data = await request("/api/v1/dashboard/admin/overview", {
        headers: { "x-admin-token": getAdminToken() }
      });
      setMetrics(data.metrics || null);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadNotifications = async () => {
    try {
      setNotificationsError("");
      const data = await request("/api/v1/dashboard/admin/notifications?page=1&limit=20", {
        headers: { "x-admin-token": getAdminToken() }
      });
      setNotifications(data.notifications || []);
    } catch (err) {
      setNotificationsError(err.message);
    }
  };

  useEffect(() => {
    load();
    loadNotifications();
    const intervalId = setInterval(load, 10000);
    const notificationsIntervalId = setInterval(loadNotifications, 15000);
    return () => {
      clearInterval(intervalId);
      clearInterval(notificationsIntervalId);
    };
  }, []);

  return (
    <section className="space-y-4">
      <article className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Platform Metrics</h2>
          <button className="btn" onClick={load}>
            Refresh
          </button>
        </div>
        {error && <p className="mb-2 text-sm font-semibold text-red-700">{error}</p>}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {metrics &&
                Object.entries(metrics).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{String(v)}</td>
                  </tr>
                ))}
              {!metrics && (
                <tr>
                  <td colSpan={2} className="text-center text-slate-500">
                    No metrics loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Admin Notifications</h2>
          <button className="btn-secondary" onClick={loadNotifications}>
            Refresh Notifications
          </button>
        </div>
        {notificationsError && <p className="mb-2 text-sm font-semibold text-red-700">{notificationsError}</p>}
        <div className="space-y-2">
          {notifications.map((item) => (
            <article key={item._id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-900">{item.title}</p>
              <p className="text-sm text-slate-700">{item.message}</p>
              <p className="mt-1 text-xs text-slate-500">
                {item.actorName || "Admin"} {item.actorEmail ? `(${item.actorEmail})` : ""} •{" "}
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
          {notifications.length === 0 && <p className="text-sm text-slate-500">No notifications yet.</p>}
        </div>
      </article>
    </section>
  );
}
