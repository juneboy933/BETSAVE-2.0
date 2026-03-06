"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiBase, getPartnerCreds, getPartnerName, getPartnerOperatingMode, request, signedRequest } from "../../../lib/api";

const toPositive = (value) => Math.max(0, Number(value) || 0);
const toAmount = (value) => Number(value) || 0;
const normalizePhone = (value) => String(value || "").trim();
const phoneDigits = (value) => String(value || "").replace(/\D/g, "");

const buildIdempotencyKey = (prefix) => {
  const token = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${prefix}-${token}`;
};

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

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");

  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpPhone, setOtpPhone] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingUser, setIsResolvingUser] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [operatingMode, setOperatingMode] = useState("demo");

  const partnerCreds = useMemo(() => getPartnerCreds(), []);
  const hasPartnerCreds = useMemo(() => Boolean(partnerCreds.apiKey && partnerCreds.apiSecret), [partnerCreds]);
  const activePartnerName = useMemo(() => {
    const stored = String(getPartnerName() || "").trim();
    if (stored) return stored;
    const inferred = String(partnerCreds.apiKey || "").split("_")[0].replace(/_/g, " ").trim();
    return inferred || "";
  }, [partnerCreds.apiKey]);

  const normalizedUserPhone = useMemo(() => normalizePhone(userPhone), [userPhone]);
  const isReady = useMemo(() => normalizedUserPhone && (userId.trim() || hasPartnerCreds), [normalizedUserPhone, userId, hasPartnerCreds]);

  const userHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      "x-user-phone": normalizedUserPhone
    }),
    [normalizedUserPhone]
  );

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
    if (!hasPartnerCreds) return null;
    if (!normalizedUserPhone) return null;

    try {
      setIsResolvingUser(true);
      const data = await signedRequest({
        method: "GET",
        path: "/api/v1/dashboard/partner/users?page=1&limit=500",
        body: {},
        apiKey: partnerCreds.apiKey,
        apiSecret: partnerCreds.apiSecret
      });

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
    if (!hasPartnerCreds || !normalizedUserPhone) return;
    try {
      const data = await signedRequest({
        method: "GET",
        path: "/api/v1/dashboard/partner/users?page=1&limit=100",
        body: {},
        apiKey: partnerCreds.apiKey,
        apiSecret: partnerCreds.apiSecret
      });
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

      const partnerQuery = activePartnerName ? `?partnerName=${encodeURIComponent(activePartnerName)}` : "";
      const [dashboard, eventRows, savingsRows] = await Promise.all([
        request(`/api/v1/dashboard/user/${resolvedUserId}${partnerQuery}`, { headers: userHeaders }),
        request(`/api/v1/dashboard/user/${resolvedUserId}/events?page=1&limit=20`, { headers: userHeaders }),
        request(`/api/v1/dashboard/user/${resolvedUserId}/transactions?page=1&limit=20`, { headers: userHeaders })
      ]);

      let paymentRows = { transactions: [] };
      try {
        paymentRows = await request(`/api/v1/payments/${resolvedUserId}/transactions?page=1&limit=20`, {
          headers: userHeaders
        });
      } catch {
        paymentRows = { transactions: [] };
      }

      setSummary(dashboard);
      setEvents(eventRows.events || []);
      setSavingsTransactions(savingsRows.transactions || []);
      setPaymentTransactions(paymentRows.transactions || []);
      await loadPartnerUserState();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setOperatingMode(getPartnerOperatingMode());
    if (!isReady) return;
    loadUserData();
    const intervalId = setInterval(loadUserData, 10000);
    return () => clearInterval(intervalId);
  }, [isReady, userId, userPhone]);

  useEffect(() => {
    const intervalId = setInterval(() => setOperatingMode(getPartnerOperatingMode()), 2000);
    return () => clearInterval(intervalId);
  }, []);

  const syncAutoSavingsPreference = async (autoSavingsEnabled) => {
    if (operatingMode !== "demo") {
      setError("User demo controls are disabled in live mode.");
      return;
    }
    if (!normalizedUserPhone) {
      setError("Enter user phone number first.");
      return;
    }
    if (!hasPartnerCreds) {
      setError("Missing partner credentials. Login as partner first.");
      return;
    }

    try {
      setIsSubmitting(true);
      clearNotices();
      const result = await signedRequest({
        method: "POST",
        path: "/api/v1/partners/users/register",
        body: {
          phone: normalizedUserPhone,
          autoSavingsEnabled
        },
        apiKey: partnerCreds.apiKey,
        apiSecret: partnerCreds.apiSecret
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
    if (!hasPartnerCreds) {
      setError("Missing partner credentials. Login as partner first.");
      return;
    }

    try {
      setIsSubmitting(true);
      clearNotices();
      await signedRequest({
        method: "POST",
        path: "/api/v1/partners/users/verify-otp",
        body: {
          phone: otpPhone.trim(),
          otp: otpCode.trim()
        },
        apiKey: partnerCreds.apiKey,
        apiSecret: partnerCreds.apiSecret
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

  const initiateDeposit = async () => {
    if (operatingMode !== "demo") {
      setError("User demo controls are disabled in live mode.");
      return;
    }
    if (!isReady) return;
    try {
      const amount = Number(depositAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setError("Enter a valid deposit amount.");
        return;
      }

      setIsSubmitting(true);
      clearNotices();

      await request(`/api/v1/payments/${userId}/deposits`, {
        method: "POST",
        headers: userHeaders,
        body: JSON.stringify({
          phone: normalizedUserPhone,
          amount,
          channel: "STK",
          idempotencyKey: buildIdempotencyKey("dep"),
          externalRef: `USER_DEMO_DEP_${Date.now()}`
        })
      });

      setMessage("STK deposit initiated. Await callback settlement.");
      setDepositAmount("");
      await loadUserData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const initiateWithdrawal = async () => {
    if (operatingMode !== "demo") {
      setError("User demo controls are disabled in live mode.");
      return;
    }
    if (!isReady) return;
    try {
      const amount = Number(withdrawalAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setError("Enter a valid withdrawal amount.");
        return;
      }

      setIsSubmitting(true);
      clearNotices();

      await request(`/api/v1/payments/${userId}/withdrawals`, {
        method: "POST",
        headers: userHeaders,
        body: JSON.stringify({
          phone: normalizedUserPhone,
          amount,
          idempotencyKey: buildIdempotencyKey("wd"),
          notes: "User demo withdrawal"
        })
      });

      setMessage("Withdrawal request submitted.");
      setWithdrawalAmount("");
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
          Demo only: this mimics how partners can build user wallet UX on top of Betsave APIs. In live mode, user entry
          points should come from partner systems, while Betsave handles settlement and ledgering.
        </section>
        <p className="text-xs text-slate-500">
          API Base: <span className="mono">{getApiBase()}</span>
        </p>
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
            disabled={!normalizedUserPhone || !hasPartnerCreds || isResolvingUser}
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
        <h3 className="text-base font-bold">Demo Payment Actions</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">STK Deposit</p>
            <input
              className="input"
              type="number"
              placeholder="Amount"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <button className="btn w-full" disabled={!isReady || isSubmitting} onClick={initiateDeposit}>
              Initiate STK Deposit
            </button>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Withdrawal</p>
            <input
              className="input"
              type="number"
              placeholder="Amount"
              value={withdrawalAmount}
              onChange={(e) => setWithdrawalAmount(e.target.value)}
            />
            <button className="btn-secondary w-full" disabled={!isReady || isSubmitting} onClick={initiateWithdrawal}>
              Request Withdrawal
            </button>
          </div>
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
