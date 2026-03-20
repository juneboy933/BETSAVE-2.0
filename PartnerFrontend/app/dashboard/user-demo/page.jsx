"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getPartnerOperatingMode,
  hasPartnerSession,
  partnerRequest
} from "../../../lib/api";
import { attachVisiblePolling } from "../../../lib/polling";

const toPositive = (value) => Math.max(0, Number(value) || 0);
const toAmount = (value) => Number(value) || 0;
const normalizePhone = (value) => String(value || "").trim();
const phoneDigits = (value) => String(value || "").replace(/\D/g, "");

const statusClass = (status) => {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "SUCCESS" || normalized === "DISBURSED" || normalized === "VERIFIED" || normalized === "ACTIVE") {
    return "bg-emerald-50 text-emerald-800 font-semibold";
  }
  if (normalized === "FAILED" || normalized === "SUSPENDED" || normalized === "REVERSED") {
    return "bg-red-50 text-red-800 font-semibold";
  }
  return "bg-slate-100 text-slate-700 font-semibold";
};

export default function PartnerDashboardUserDemo() {
  const [userId, setUserId] = useState("");
  const [userPhone, setUserPhone] = useState("");

  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [savingsTransactions, setSavingsTransactions] = useState([]);
  const [paymentTransactions, setPaymentTransactions] = useState([]);
  const [partnerUser, setPartnerUser] = useState(null);
  const [withdrawalPolicy, setWithdrawalPolicy] = useState(null);
  const [recentWithdrawalLogs, setRecentWithdrawalLogs] = useState([]);
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: "",
    notes: "",
    idempotencyKey: `partner-demo-withdrawal-${Date.now()}`
  });

  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpPhone, setOtpPhone] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingUser, setIsResolvingUser] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [operatingMode, setOperatingMode] = useState("demo");

  const normalizedUserPhone = useMemo(() => normalizePhone(userPhone), [userPhone]);
  const isReady = useMemo(() => Boolean(normalizedUserPhone && (userId.trim() || hasPartnerSession())), [normalizedUserPhone, userId]);

  const depositRows = useMemo(
    () => paymentTransactions.filter((tx) => String(tx.type || "").toUpperCase() === "DEPOSIT"),
    [paymentTransactions]
  );
  const withdrawalRows = useMemo(
    () => paymentTransactions.filter((tx) => String(tx.type || "").toUpperCase() === "WITHDRAWAL"),
    [paymentTransactions]
  );
  const walletTransactions = useMemo(() => {
    const savingsRows = (savingsTransactions || []).map((row) => ({
      id: `SAV-${row._id}`,
      category: "SAVINGS_CREDIT",
      status: "SUCCESS",
      direction: "IN",
      amount: Number(row.amount) || 0,
      channel: "LEDGER",
      reference: row.reference || row.eventId || "-",
      providerRequestId: null,
      createdAt: row.createdAt || null
    }));

    const paymentRows = (paymentTransactions || []).map((tx) => {
      const normalizedType = String(tx.type || "").toUpperCase();
      const isWithdrawal = normalizedType === "WITHDRAWAL";
      const amount = Number(tx.amount) || 0;
      return {
        id: `PAY-${tx._id}`,
        category: normalizedType || "PAYMENT",
        status: String(tx.status || "PENDING").toUpperCase(),
        direction: isWithdrawal ? "OUT" : "IN",
        amount: isWithdrawal ? -amount : amount,
        channel: tx.channel || "-",
        reference: tx.externalRef || tx.providerTransactionId || "-",
        providerRequestId: tx.providerRequestId || null,
        createdAt: tx.createdAt || null
      };
    });

    return [...savingsRows, ...paymentRows].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }, [paymentTransactions, savingsTransactions]);

  const clearNotices = () => {
    setError("");
    setMessage("");
  };

  const resolveUserIdFromPartnerPhone = async () => {
    if (!hasPartnerSession()) return null;
    if (!normalizedUserPhone) return null;

    try {
      setIsResolvingUser(true);
      const data = await partnerRequest("/api/v1/dashboard/partner/users?page=1&limit=500");

      const phoneNeedle = phoneDigits(normalizedUserPhone);
      const match = (data.users || []).find((item) => {
        const candidatePhone = normalizePhone(item?.phoneNumber);
        return candidatePhone === normalizedUserPhone || phoneDigits(candidatePhone) === phoneNeedle;
      });

      if (!match?.userId) {
        return null;
      }

      const resolvedUserId = String(match.userId);
      setUserId(resolvedUserId);
      setPartnerUser(match);
      return resolvedUserId;
    } catch {
      return null;
    } finally {
      setIsResolvingUser(false);
    }
  };

  const loadPartnerUserState = async () => {
    if (!hasPartnerSession() || !normalizedUserPhone) return;
    try {
      const data = await partnerRequest("/api/v1/dashboard/partner/users?page=1&limit=100");
      const phoneNeedle = phoneDigits(normalizedUserPhone);
      const match = (data.users || []).find((item) => {
        const candidatePhone = normalizePhone(item?.phoneNumber);
        return candidatePhone === normalizedUserPhone || phoneDigits(candidatePhone) === phoneNeedle;
      });
      setPartnerUser(match || null);
    } catch {
      setPartnerUser(null);
    }
  };

  const loadUserData = async () => {
    if (!normalizedUserPhone) {
      setError("Enter user phone to load demo data.");
      return;
    }
    try {
      setIsLoading(true);
      setError("");

      let resolvedUserId = userId.trim();
      if (!resolvedUserId) {
        resolvedUserId = await resolveUserIdFromPartnerPhone();
      }

      if (!resolvedUserId) {
        setError("Could not resolve user ID for this phone. Register/link the user first from Partner Users.");
        return;
      }

      const query = new URLSearchParams();
      query.set("userId", resolvedUserId);
      if (normalizedUserPhone) {
        query.set("phone", normalizedUserPhone);
      }

      const data = await partnerRequest(`/api/v1/dashboard/partner/user-demo?${query.toString()}`);

      setSummary(data.summary || null);
      setEvents(data.events || []);
      setSavingsTransactions(data.savingsTransactions || []);
      setPaymentTransactions(data.paymentTransactions || []);
      setPartnerUser(data.partnerUser || null);
      setWithdrawalPolicy(data.withdrawalPolicy || null);
      setRecentWithdrawalLogs(data.recentWithdrawalLogs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const requestDemoWithdrawal = async () => {
    if (!normalizedUserPhone) {
      setError("Enter user phone to request a withdrawal.");
      return;
    }

    try {
      setIsSubmitting(true);
      clearNotices();

      let resolvedUserId = userId.trim();
      if (!resolvedUserId) {
        resolvedUserId = await resolveUserIdFromPartnerPhone();
      }

      if (!resolvedUserId) {
        setError("Could not resolve user ID for this phone. Register/link the user first from Partner Users.");
        return;
      }

      const result = await partnerRequest(`/api/v1/partners/users/${encodeURIComponent(resolvedUserId)}/withdrawals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizedUserPhone,
          amount: Number(withdrawalForm.amount),
          notes: withdrawalForm.notes.trim(),
          idempotencyKey: withdrawalForm.idempotencyKey.trim()
        })
      });

      setMessage(`Withdrawal queued: ${result.paymentTransaction?._id || result.withdrawalRequest?._id || "request accepted"}`);
      setWithdrawalForm({
        amount: "",
        notes: "",
        idempotencyKey: `partner-demo-withdrawal-${Date.now()}`
      });
      await loadUserData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    setOperatingMode(getPartnerOperatingMode());
    if (!isReady) return;
    return attachVisiblePolling(loadUserData);
  }, [isReady, userId, userPhone]);

  useEffect(() => {
    const onPartnerModeChanged = () => {
      setOperatingMode(getPartnerOperatingMode());
      if (isReady) {
        loadUserData();
      }
    };
    window.addEventListener("partner-mode-changed", onPartnerModeChanged);
    return () => window.removeEventListener("partner-mode-changed", onPartnerModeChanged);
  }, [isReady, userId, userPhone]);

  const syncAutoSavingsPreference = async (autoSavingsEnabled) => {
    if (operatingMode !== "demo") {
      setError("User demo controls are disabled in live mode.");
      return;
    }
    if (!normalizedUserPhone) {
      setError("Enter user phone number first.");
      return;
    }
    if (!hasPartnerSession()) {
      setError("Partner session is missing. Login again.");
      return;
    }

    try {
      setIsSubmitting(true);
      clearNotices();
      const result = await partnerRequest("/api/v1/partners/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizedUserPhone,
          autoSavingsEnabled
        })
      });

      if (result.requiresOtp) {
        setOtpPhone(result.phoneNumber || normalizedUserPhone);
        setOtpCode("");
        setOtpModalOpen(true);
        setMessage("OTP requested. Enter OTP to verify and activate user for auto-savings.");
      } else {
        setMessage(autoSavingsEnabled ? "Auto-savings enabled for user." : "Auto-savings disabled for user.");
      }

      if (result.userId) {
        setUserId(String(result.userId));
      }

      await loadPartnerUserState();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    if (operatingMode !== "demo") {
      setError("User demo controls are disabled in live mode.");
      return;
    }
    if (!otpPhone.trim() || !otpCode.trim()) {
      setError("Provide OTP phone and code.");
      return;
    }
    if (!hasPartnerSession()) {
      setError("Partner session is missing. Login again.");
      return;
    }

    try {
      setIsSubmitting(true);
      clearNotices();
      await partnerRequest("/api/v1/partners/users/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: otpPhone.trim(),
          otp: otpCode.trim()
        })
      });

      setOtpModalOpen(false);
      setOtpCode("");
      setMessage("OTP verified successfully.");
      await loadPartnerUserState();
      await loadUserData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (operatingMode !== "demo") {
    return (
      <section className="space-y-4">
        <article className="card">
          <h2 className="text-lg font-bold">User Demo Disabled</h2>
          <p className="mt-2 text-sm text-slate-700">
            Partner mode is <span className="font-semibold uppercase">{operatingMode}</span>. Demo tools are only available in demo mode for safe sandbox walkthroughs.
          </p>
        </article>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <article className="card space-y-3">
        <h2 className="text-lg font-bold">User Wallet Demo Dashboard</h2>
        <section className="callout">
          Demo only: this page now shows partner-scoped demo activity through secure partner endpoints. Real money
          movement walkthroughs should be triggered from the Event Stream so they stay mode-scoped and auditable.
        </section>
        <div className="grid gap-2 md:grid-cols-2">
          <input className="input" placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
          <input className="input" placeholder="User Phone (+254...)" value={userPhone} onChange={(e) => setUserPhone(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={loadUserData} disabled={!normalizedUserPhone || isLoading || isResolvingUser}>
            {isLoading ? "Loading..." : "Load User Data"}
          </button>
          <button
            className="btn-secondary"
            onClick={resolveUserIdFromPartnerPhone}
            disabled={!normalizedUserPhone || !hasPartnerSession() || isResolvingUser}
          >
            {isResolvingUser ? "Resolving..." : "Resolve User ID By Phone"}
          </button>
          <button
            className="btn-secondary"
            onClick={() => syncAutoSavingsPreference(true)}
            disabled={!normalizedUserPhone || isSubmitting}
          >
            Enable Auto-Savings
          </button>
          <button
            className="btn-secondary"
            onClick={() => syncAutoSavingsPreference(false)}
            disabled={!normalizedUserPhone || isSubmitting}
          >
            Disable Auto-Savings
          </button>
        </div>
        {partnerUser && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Partner Link Status</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className={statusClass(partnerUser.status)}>{partnerUser.status}</span>
              <span className={statusClass(partnerUser.autoSavingsEnabled ? "ACTIVE" : "PENDING")}>
                Auto-Savings: {partnerUser.autoSavingsEnabled ? "ON" : "OFF"}
              </span>
              <span className="text-slate-600">Source: {partnerUser.source || "-"}</span>
            </div>
          </div>
        )}
        {message && <p className="text-sm font-semibold text-emerald-700">{message}</p>}
        {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
      </article>

      <article className="card">
        <h3 className="mb-3 text-base font-bold">Wallet And Savings Snapshot</h3>
        <div className="stats-grid">
          <article className="metric-tile">
            <p className="text-xs uppercase tracking-wide text-slate-500">Partner Wallet Scope</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{toPositive(summary?.partnerAttributedWalletBalance)}</p>
          </article>
          <article className="metric-tile">
            <p className="text-xs uppercase tracking-wide text-slate-500">Saved On This Partner</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{toPositive(summary?.savings?.currentPlatform?.totalSaved)}</p>
          </article>
          <article className="metric-tile">
            <p className="text-xs uppercase tracking-wide text-slate-500">Cumulative Savings</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{toPositive(summary?.savings?.cumulativeTotalSaved)}</p>
          </article>
          <article className="metric-tile">
            <p className="text-xs uppercase tracking-wide text-slate-500">Platforms Linked</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{toPositive(summary?.savings?.byPlatform?.length)}</p>
          </article>
        </div>
      </article>

      <article className="card">
        <h3 className="mb-2 text-base font-bold">Savings By Platform</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Total Saved</th>
                <th>Entries</th>
                <th>Live</th>
                <th>Demo</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.savings?.byPlatform || []).map((row) => (
                <tr key={row.partnerName}>
                  <td>{row.partnerName}</td>
                  <td>{toAmount(row.totalSaved)}</td>
                  <td>{toAmount(row.entries)}</td>
                  <td>{toAmount(row?.byMode?.live)}</td>
                  <td>{toAmount(row?.byMode?.demo)}</td>
                </tr>
              ))}
              {(summary?.savings?.byPlatform || []).length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-slate-500">
                    No platform savings loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card space-y-3">
        <h3 className="text-base font-bold">Money Movement Demo Policy</h3>
        <section className="callout">
          This demo withdrawal flow is now routed through the secure partner withdrawal API. It stays fully logged for
          admin and partner visibility, and it still honors live withdrawal maturity rules if the user wallet is backed
          by live funds instead of demo-only activity.
        </section>
        <div className="grid gap-3 md:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Withdrawal Mode</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{String(withdrawalPolicy?.operatingMode || "demo").toUpperCase()}</p>
            <p className="mt-2 text-sm text-slate-600">
              {withdrawalPolicy?.eligible
                ? "This user is currently eligible for withdrawal under the active policy."
                : withdrawalPolicy?.denialReason || "Load user data to evaluate withdrawal eligibility."}
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Policy Snapshot</p>
            <p className="mt-2 text-sm text-slate-700">Current balance: KES {toPositive(withdrawalPolicy?.currentBalance)}</p>
            <p className="mt-1 text-sm text-slate-700">Live threshold: KES {toPositive(withdrawalPolicy?.liveMinBalanceKes)}</p>
            <p className="mt-1 text-sm text-slate-700">Maturity window: {toPositive(withdrawalPolicy?.minAutoSavingsDays)} days</p>
            <p className="mt-1 text-sm text-slate-700">
              First eligible:
              {" "}
              {withdrawalPolicy?.firstEligibleAt ? new Date(withdrawalPolicy.firstEligibleAt).toLocaleString() : "-"}
            </p>
          </article>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="input"
            type="number"
            min="1"
            placeholder="Withdrawal amount"
            value={withdrawalForm.amount}
            onChange={(e) => setWithdrawalForm((prev) => ({ ...prev, amount: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Idempotency key"
            value={withdrawalForm.idempotencyKey}
            onChange={(e) => setWithdrawalForm((prev) => ({ ...prev, idempotencyKey: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Notes"
            value={withdrawalForm.notes}
            onChange={(e) => setWithdrawalForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn"
            onClick={requestDemoWithdrawal}
            disabled={!normalizedUserPhone || !withdrawalForm.amount || !withdrawalForm.idempotencyKey.trim() || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Request Demo Withdrawal"}
          </button>
          <button className="btn-secondary" onClick={loadUserData} disabled={!normalizedUserPhone || isLoading}>
            Refresh Wallet State
          </button>
        </div>
      </article>

      <article className="card">
        <h3 className="mb-2 text-base font-bold">Wallet Transaction Feed</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Status</th>
                <th>Direction</th>
                <th>Amount</th>
                <th>Channel</th>
                <th>Reference</th>
                <th>Provider Request ID</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {walletTransactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.category}</td>
                  <td className={statusClass(tx.status)}>{tx.status}</td>
                  <td>{tx.direction}</td>
                  <td>{toAmount(tx.amount)}</td>
                  <td>{tx.channel}</td>
                  <td>{tx.reference}</td>
                  <td className="mono text-xs">{tx.providerRequestId || "-"}</td>
                  <td>{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "-"}</td>
                </tr>
              ))}
              {walletTransactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-slate-500">
                    No wallet transactions loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3 className="mb-2 text-base font-bold">Partner Events Reflected For User</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Partner</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event._id}>
                  <td>{event.eventId}</td>
                  <td className={statusClass(event.status)}>{event.status}</td>
                  <td>{toAmount(event.amount)}</td>
                  <td>{event.partnerName || "-"}</td>
                  <td>{event.createdAt ? new Date(event.createdAt).toLocaleString() : "-"}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-slate-500">
                    No user events loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3 className="mb-2 text-base font-bold">Recent Savings Entries</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Amount</th>
                <th>Reference</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {savingsTransactions.map((row) => (
                <tr key={row._id}>
                  <td>{row.eventId}</td>
                  <td>{toAmount(row.amount)}</td>
                  <td>{row.reference || "-"}</td>
                  <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
                </tr>
              ))}
              {savingsTransactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-slate-500">
                    No savings entries loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3 className="mb-2 text-base font-bold">Withdrawal Transactions</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Amount</th>
                <th>Channel</th>
                <th>Provider Request ID</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {withdrawalRows.map((tx) => (
                <tr key={tx._id}>
                  <td className={statusClass(tx.status)}>{tx.status}</td>
                  <td>{toAmount(tx.amount)}</td>
                  <td>{tx.channel}</td>
                  <td className="mono text-xs">{tx.providerRequestId || "-"}</td>
                  <td>{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "-"}</td>
                </tr>
              ))}
              {withdrawalRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-slate-500">
                    No withdrawals loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3 className="mb-2 text-base font-bold">Withdrawal Trace Log</h3>
        <p className="mb-3 text-sm text-slate-600">
          This partner-scoped trace shows the secure withdrawal lifecycle from policy check to provider callback so support teams can explain what happened without guessing.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Level</th>
                <th>Action</th>
                <th>Status</th>
                <th>Message</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {recentWithdrawalLogs.map((item) => (
                <tr key={item._id}>
                  <td>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</td>
                  <td>{item.level || "-"}</td>
                  <td>{item.action || "-"}</td>
                  <td className={statusClass(item.status)}>{item.status || "-"}</td>
                  <td>{item.message || "-"}</td>
                  <td className="mono text-xs">{item.paymentTransactionId || item.withdrawalRequestId || "-"}</td>
                </tr>
              ))}
              {recentWithdrawalLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-slate-500">
                    No withdrawal trace logs loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3 className="mb-2 text-base font-bold">Deposit Transactions</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Amount</th>
                <th>Channel</th>
                <th>Provider Request ID</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {depositRows.map((tx) => (
                <tr key={tx._id}>
                  <td className={statusClass(tx.status)}>{tx.status}</td>
                  <td>{toAmount(tx.amount)}</td>
                  <td>{tx.channel}</td>
                  <td className="mono text-xs">{tx.providerRequestId || "-"}</td>
                  <td>{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "-"}</td>
                </tr>
              ))}
              {depositRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-slate-500">
                    No deposits loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {otpModalOpen && (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <article className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-3">
            <h3 className="text-base font-bold text-slate-900">Verify User OTP</h3>
            <p className="text-sm text-slate-600">
              Enter the OTP sent to <span className="font-semibold">{otpPhone}</span> to complete verification.
            </p>
            <input
              className="input"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="4-digit OTP"
              maxLength={6}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() => {
                  setOtpModalOpen(false);
                  setOtpCode("");
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button className="btn" onClick={verifyOtp} disabled={isSubmitting}>
                Verify OTP
              </button>
            </div>
          </article>
        </section>
      )}
    </section>
  );
}
