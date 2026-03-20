"use client";

import { useCallback, useEffect, useState } from "react";
import { request } from "../../../lib/api";

const emptyForm = {
  invitedName: "",
  invitedEmail: "",
  notes: ""
};

export default function AdminDashboardAccessPage() {
  const [form, setForm] = useState(emptyForm);
  const [createdInvitation, setCreatedInvitation] = useState(null);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [usedInvitations, setUsedInvitations] = useState([]);
  const [canManageAdminInvitations, setCanManageAdminInvitations] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setError("");
      const session = await request("/api/v1/admin/auth/session");
      const allowed = Boolean(session?.admin?.canManageAdminInvitations);
      setCanManageAdminInvitations(allowed);

      if (!allowed) {
        setPendingInvitations([]);
        setUsedInvitations([]);
        setCreatedInvitation(null);
        return;
      }

      const [pending, used] = await Promise.all([
        request("/api/v1/admin/auth/invitations?status=PENDING"),
        request("/api/v1/admin/auth/invitations?status=USED")
      ]);
      setPendingInvitations(pending.invitations || []);
      setUsedInvitations(used.invitations || []);
    } catch (err) {
      setError(err.message || "Failed to load admin invitations");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createInvitation = async () => {
    try {
      setError("");
      setCopyMessage("");
      setIsSubmitting(true);

      const payload = {
        invitedName: form.invitedName.trim(),
        invitedEmail: form.invitedEmail.trim(),
        notes: form.notes.trim()
      };

      if (!payload.invitedName || !payload.invitedEmail) {
        setError("Invited name and email are required.");
        return;
      }
      if (!canManageAdminInvitations) {
        setError("Only the primary admin can create admin invitations.");
        return;
      }

      const result = await request("/api/v1/admin/auth/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      setCreatedInvitation(result.invitation || null);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to create admin invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const revokeInvitation = async (invitationId) => {
    try {
      setError("");
      await request(`/api/v1/admin/auth/invitations/${invitationId}`, {
        method: "DELETE"
      });
      if (String(createdInvitation?.id || "") === String(invitationId)) {
        setCreatedInvitation(null);
      }
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to revoke invitation");
    }
  };

  const copyInvitationCode = async () => {
    const code = String(createdInvitation?.code || "").trim();
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopyMessage("Invitation code copied.");
    } catch {
      setCopyMessage("Copy failed. Use the code shown below.");
    }
  };

  return (
    <section className="space-y-4">
      <article className="card">
        <div className="section-head">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Admin Access</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Invitation-only onboarding</h2>
          </div>
          <button className="btn" onClick={refresh}>
            Refresh
          </button>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Existing admins create a one-time code here, send that code to the invited admin through your normal secure
          channel, and the invited admin completes registration on the admin <span className="font-semibold">/register</span> page.
          The full code is shown only once at creation time.
        </p>
        {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {copyMessage ? <p className="mt-2 text-sm font-semibold text-emerald-700">{copyMessage}</p> : null}
      </article>

      {!canManageAdminInvitations ? (
        <article className="card">
          <h3 className="text-lg font-bold text-slate-950">Restricted</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This account can view the admin dashboard but cannot issue invitation codes. Only the primary admin created
            during system bootstrap can manage admin invitations.
          </p>
        </article>
      ) : null}

      {canManageAdminInvitations ? (
      <article className="card">
        <h3 className="text-lg font-bold text-slate-950">Create Invitation</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Invited Name</label>
            <input
              className="input"
              value={form.invitedName}
              onChange={(e) => setForm((current) => ({ ...current, invitedName: e.target.value }))}
              placeholder="Jane Ops"
            />
          </div>
          <div>
            <label className="label">Invited Email</label>
            <input
              className="input"
              value={form.invitedEmail}
              onChange={(e) => setForm((current) => ({ ...current, invitedEmail: e.target.value }))}
              placeholder="jane@example.com"
            />
          </div>
        </div>
        <label className="label">Notes</label>
        <textarea
          className="input min-h-28"
          value={form.notes}
          onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
          placeholder="Optional handoff note for audit context"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn" onClick={createInvitation} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Invitation"}
          </button>
        </div>
      </article>
      ) : null}

      {canManageAdminInvitations && createdInvitation ? (
        <article className="card">
          <h3 className="text-lg font-bold text-slate-950">Latest Invitation</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This is the only place the full invitation code is returned. If you lose it, revoke the invitation and issue a new one.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Code</p>
              <p className="mt-2 break-all font-mono text-sm text-slate-950">{createdInvitation.code}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Registration Route</p>
              <p className="mt-2 font-semibold text-slate-950">{createdInvitation.registerPath || "/register"}</p>
              <p className="mt-2 text-sm text-slate-600">
                Invite {createdInvitation.invitedEmail} before {createdInvitation.expiresAt ? new Date(createdInvitation.expiresAt).toLocaleString() : "expiry"}.
              </p>
            </article>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn" onClick={copyInvitationCode}>
              Copy Code
            </button>
            <button className="btn-secondary" onClick={() => revokeInvitation(createdInvitation.id)}>
              Revoke Latest Invitation
            </button>
          </div>
        </article>
      ) : null}

      {canManageAdminInvitations ? (
      <article className="card">
        <h3 className="text-lg font-bold text-slate-950">Pending Invitations</h3>
        <div className="table-wrap mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Masked Code</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingInvitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td>{invitation.invitedName}</td>
                  <td>{invitation.invitedEmail}</td>
                  <td className="font-mono text-xs">{invitation.code}</td>
                  <td>{invitation.status}</td>
                  <td>{invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleString() : "-"}</td>
                  <td>
                    <button className="btn-secondary" onClick={() => revokeInvitation(invitation.id)}>
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
              {pendingInvitations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-slate-500">
                    No pending invitations.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
      ) : null}

      {canManageAdminInvitations ? (
      <article className="card">
        <h3 className="text-lg font-bold text-slate-950">Used Invitations</h3>
        <div className="table-wrap mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Masked Code</th>
                <th>Status</th>
                <th>Used</th>
              </tr>
            </thead>
            <tbody>
              {usedInvitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td>{invitation.invitedName}</td>
                  <td>{invitation.invitedEmail}</td>
                  <td className="font-mono text-xs">{invitation.code}</td>
                  <td>{invitation.status}</td>
                  <td>{invitation.usedAt ? new Date(invitation.usedAt).toLocaleString() : "-"}</td>
                </tr>
              ))}
              {usedInvitations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-slate-500">
                    No used invitations.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
      ) : null}
    </section>
  );
}
