"use client";

import { useCallback, useEffect, useState } from "react";
import { request } from "../../../lib/api";
import { attachVisiblePolling } from "../../../lib/polling";

const formatLabel = (value) =>
  String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const boolTone = (value) => (value ? "text-emerald-700" : "text-rose-700");
const metricTone = (value) => (Number(value) > 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900");
const workerTone = (status) => {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "HEALTHY" || normalized === "RUNNING") return "bg-emerald-50 text-emerald-800";
  if (normalized === "MISSING" || normalized === "STOPPED") return "bg-slate-100 text-slate-700";
  return "bg-rose-50 text-rose-800";
};
const asDateTime = (value) => (value ? new Date(value).toLocaleString() : "-");

export default function AdminDashboardOperations() {
  const [ops, setOps] = useState(null);
  const [error, setError] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setError("");
      const data = await request("/api/v1/dashboard/admin/operations");
      setOps(data);
      setLastLoadedAt(new Date().toISOString());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    return attachVisiblePolling(refresh);
  }, [refresh]);

  useEffect(() => {
    const onAdminModeChanged = () => {
      refresh();
    };
    window.addEventListener("admin-mode-changed", onAdminModeChanged);
    return () => window.removeEventListener("admin-mode-changed", onAdminModeChanged);
  }, [refresh]);

  const scopedMetrics = ops?.operations?.scoped || {};
  const globalMetrics = ops?.operations?.global || {};
  const thresholds = ops?.operations?.thresholds || {};
  const workers = ops?.runtimeReadiness?.workers || [];
  const observabilitySummary = ops?.observability?.summary || {};
  const recentOperationalLogs = ops?.observability?.recentOperationalLogs || [];
  const settlement = ops?.operations?.settlement || {};
  const recentReconciliationRuns = ops?.observability?.recentReconciliationRuns || [];

  return (
    <section className="space-y-4">
      <article className="card">
        <div className="section-head">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Operations</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Operational readiness</h2>
          </div>
          <button className="btn" onClick={refresh}>
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Selected mode</p>
            <p className="mt-2 text-xl font-bold text-slate-950">{String(ops?.operations?.operatingMode || "live").toUpperCase()}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Last refreshed</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{asDateTime(lastLoadedAt)}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Worker fleet</p>
            <p className={`mt-2 text-sm font-semibold ${boolTone(Boolean(ops?.runtimeReadiness?.allWorkersHealthy))}`}>
              {ops?.runtimeReadiness?.allWorkersHealthy ? "Healthy" : "Attention needed"}
            </p>
          </article>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p>}
      </article>

      <article className="card">
        <h3 className="text-lg font-bold text-slate-950">Mode-Scoped Backlog</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          These numbers honor the selected admin mode and should line up with the rest of the dashboard.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {Object.entries(scopedMetrics).map(([key, value]) => (
            <article key={key} className={`rounded-2xl border p-4 ${metricTone(value)}`}>
              <p className="text-xs uppercase tracking-wide">{formatLabel(key)}</p>
              <p className="mt-2 text-2xl font-bold">{String(value)}</p>
            </article>
          ))}
          {!Object.keys(scopedMetrics).length ? (
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No scoped metrics returned.
            </article>
          ) : null}
        </div>
      </article>

      <article className="card">
        <h3 className="text-lg font-bold text-slate-950">Global Platform Counts</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          These numbers are intentionally global and do not change with the demo/live mode switch.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(globalMetrics).map(([key, value]) => (
            <article key={key} className={`rounded-2xl border p-4 ${metricTone(value)}`}>
              <p className="text-xs uppercase tracking-wide">{formatLabel(key)}</p>
              <p className="mt-2 text-2xl font-bold">{String(value)}</p>
            </article>
          ))}
          {!Object.keys(globalMetrics).length ? (
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No global metrics returned.
            </article>
          ) : null}
        </div>
      </article>

      <article className="card">
        <h3 className="text-lg font-bold text-slate-950">Thresholds</h3>
        <div className="table-wrap mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>Threshold</th>
                <th>Milliseconds</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(thresholds).map(([key, value]) => (
                <tr key={key}>
                  <td>{formatLabel(key)}</td>
                  <td>{String(value)}</td>
                </tr>
              ))}
              {!Object.keys(thresholds).length ? (
                <tr>
                  <td colSpan={2} className="text-center text-slate-500">
                    No thresholds returned.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3 className="text-lg font-bold text-slate-950">Settlement Health</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Successful Paybill collections are not fully bank-safe until they are reconciled and posted into the bank settlement ledger.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className={`rounded-2xl border p-4 ${metricTone(settlement?.selectedMode?.count || 0)}`}>
            <p className="text-xs uppercase tracking-wide">Selected mode unsettled</p>
            <p className="mt-2 text-2xl font-bold">{String(settlement?.selectedMode?.count || 0)}</p>
            <p className="mt-1 text-xs">KES {Number(settlement?.selectedMode?.amount || 0).toLocaleString()}</p>
          </article>
          <article className={`rounded-2xl border p-4 ${metricTone(settlement?.selectedMode?.staleCount || 0)}`}>
            <p className="text-xs uppercase tracking-wide">Selected mode stale</p>
            <p className="mt-2 text-2xl font-bold">{String(settlement?.selectedMode?.staleCount || 0)}</p>
            <p className="mt-1 text-xs">KES {Number(settlement?.selectedMode?.staleAmount || 0).toLocaleString()}</p>
          </article>
          <article className={`rounded-2xl border p-4 ${metricTone(settlement?.settledLast24Hours?.count || 0)}`}>
            <p className="text-xs uppercase tracking-wide">Settled last 24h</p>
            <p className="mt-2 text-2xl font-bold">{String(settlement?.settledLast24Hours?.count || 0)}</p>
            <p className="mt-1 text-xs">KES {Number(settlement?.settledLast24Hours?.totalAmount || 0).toLocaleString()}</p>
          </article>
          <article className={`rounded-2xl border p-4 ${metricTone(settlement?.unscoped?.count || 0)}`}>
            <p className="text-xs uppercase tracking-wide">Unscoped unsettled</p>
            <p className="mt-2 text-2xl font-bold">{String(settlement?.unscoped?.count || 0)}</p>
            <p className="mt-1 text-xs">KES {Number(settlement?.unscoped?.amount || 0).toLocaleString()}</p>
          </article>
        </div>
      </article>

      <article className="card">
        <h3 className="text-lg font-bold text-slate-950">Integration Readiness</h3>
        <div className="table-wrap mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>Check</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ops?.integrationReadiness || {}).map(([key, value]) => (
                <tr key={key}>
                  <td>{formatLabel(key)}</td>
                  <td className={boolTone(Boolean(value))}>{value ? "Ready" : "Missing"}</td>
                </tr>
              ))}
              {!Object.keys(ops?.integrationReadiness || {}).length ? (
                <tr>
                  <td colSpan={2} className="text-center text-slate-500">
                    No integration readiness data loaded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3 className="text-lg font-bold text-slate-950">Runtime Readiness</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Mongo transaction support</p>
            <p className={`mt-2 text-sm font-semibold ${boolTone(Boolean(ops?.runtimeReadiness?.transactionSupport))}`}>
              {ops?.runtimeReadiness?.transactionSupport ? "Available" : "Unavailable"}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">All workers healthy</p>
            <p className={`mt-2 text-sm font-semibold ${boolTone(Boolean(ops?.runtimeReadiness?.allWorkersHealthy))}`}>
              {ops?.runtimeReadiness?.allWorkersHealthy ? "Yes" : "No"}
            </p>
          </article>
        </div>
        <div className="table-wrap mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Status</th>
                <th>Last Heartbeat</th>
                <th>Last Success</th>
                <th>Last Error</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr key={worker.workerName}>
                  <td>{worker.label || formatLabel(worker.workerName)}</td>
                  <td>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${workerTone(worker.status)}`}>
                      {worker.status}
                    </span>
                  </td>
                  <td>{asDateTime(worker.lastHeartbeatAt)}</td>
                  <td>{asDateTime(worker.lastSuccessAt)}</td>
                  <td>{asDateTime(worker.lastErrorAt)}</td>
                  <td>{worker.errorMessage || "-"}</td>
                </tr>
              ))}
              {!workers.length ? (
                <tr>
                  <td colSpan={6} className="text-center text-slate-500">
                    No worker runtime data loaded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3 className="text-lg font-bold text-slate-950">Operational Activity</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This is the structured audit trail for event ingestion, Daraja payment requests, callbacks, webhooks, and recovery cycles.
        </p>
        <p className="mt-1 text-xs font-medium text-slate-500">
          Severity counts cover activity since {asDateTime(observabilitySummary.windowStartedAt)}.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Info logs</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{Number(observabilitySummary.info) || 0}</p>
          </article>
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs uppercase tracking-wide text-amber-800">Warnings</p>
            <p className="mt-2 text-2xl font-bold text-amber-900">{Number(observabilitySummary.warn) || 0}</p>
          </article>
          <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs uppercase tracking-wide text-rose-800">Errors</p>
            <p className="mt-2 text-2xl font-bold text-rose-900">{Number(observabilitySummary.error) || 0}</p>
          </article>
        </div>
        <div className="table-wrap mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Level</th>
                <th>Category</th>
                <th>Action</th>
                <th>Status</th>
                <th>Message</th>
                <th>Partner</th>
                <th>Event / Payment</th>
              </tr>
            </thead>
            <tbody>
              {recentOperationalLogs.map((item) => (
                <tr key={item._id}>
                  <td>{asDateTime(item.createdAt)}</td>
                  <td>{item.level || "-"}</td>
                  <td>{item.category || "-"}</td>
                  <td>{item.action || "-"}</td>
                  <td>{item.status || "-"}</td>
                  <td>{item.message || "-"}</td>
                  <td>{item.partnerName || "-"}</td>
                  <td>{item.eventId || item.paymentTransactionId || item.withdrawalRequestId || "-"}</td>
                </tr>
              ))}
              {!recentOperationalLogs.length ? (
                <tr>
                  <td colSpan={8} className="text-center text-slate-500">
                    No operational activity logs loaded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3 className="text-lg font-bold text-slate-950">Recent Reconciliation Runs</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          These runs show whether Paybill settlement batches actually matched successful deposits or exposed accounting gaps.
        </p>
        <div className="table-wrap mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Status</th>
                <th>Source</th>
                <th>Batch</th>
                <th>Settled</th>
                <th>Duplicates</th>
                <th>Unmatched</th>
                <th>Variance</th>
              </tr>
            </thead>
            <tbody>
              {recentReconciliationRuns.map((run) => (
                <tr key={run._id}>
                  <td>{asDateTime(run.createdAt)}</td>
                  <td>{run.status || "-"}</td>
                  <td>{run.source || "-"}</td>
                  <td>{run.batchReference || "-"}</td>
                  <td>{run.settledTransactions || 0}</td>
                  <td>{run.duplicateTransactions || 0}</td>
                  <td>{run.unmatchedTransactions || 0}</td>
                  <td>{Number(run.variance || 0).toLocaleString()}</td>
                </tr>
              ))}
              {!recentReconciliationRuns.length ? (
                <tr>
                  <td colSpan={8} className="text-center text-slate-500">
                    No reconciliation runs loaded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3 className="text-lg font-bold text-slate-950">Operational Roadmap</h3>
        <div className="table-wrap mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>Next Milestone</th>
              </tr>
            </thead>
            <tbody>
              {(ops?.roadmap?.nextMilestones || []).map((item, idx) => (
                <tr key={`${idx}-${item}`}>
                  <td>{item}</td>
                </tr>
              ))}
              {!(ops?.roadmap?.nextMilestones || []).length ? (
                <tr>
                  <td className="text-center text-slate-500">No roadmap items returned.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
