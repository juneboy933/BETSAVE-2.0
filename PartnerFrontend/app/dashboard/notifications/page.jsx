"use client";

import { useCallback, useEffect, useState } from "react";
import { partnerRequest } from "../../../lib/api";
import { attachVisiblePolling } from "../../../lib/polling";

export default function PartnerDashboardNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const load = useCallback(async () => {
    try {
      setError("");
      await partnerRequest("/api/v1/dashboard/partner/notifications/read-all", {
        method: "PATCH"
      });

      const data = await partnerRequest(`/api/v1/dashboard/partner/notifications?page=${currentPage}&limit=${pageSize}`);
      setNotifications(data.notifications || []);
      setTotal(Number(data.total) || 0);
    } catch (err) {
      setError(err.message);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    return attachVisiblePolling(load);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <article className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Partner Notifications</h2>
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
              <th>Type</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((item) => (
              <tr key={item._id}>
                <td>{item.title}</td>
                <td>{item.message}</td>
                <td>{item.type}</td>
                <td>{new Date(item.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {notifications.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-500">
                  No notifications loaded.
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
