"use client";

import { useEffect, useState } from "react";
import { getPartnerCreds, request, setPartnerCreds } from "../../lib/api";

export default function IntegrationPage() {
  const [form, setForm] = useState({ name: "", webhookUrl: "" });
  const [loginForm, setLoginForm] = useState({ apiKey: "", apiSecret: "" });
  const [creds, setCreds] = useState({ apiKey: "", apiSecret: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => setCreds(getPartnerCreds()), []);

  const createPartner = async () => {
    try {
      setErr("");
      const result = await request("/api/v1/partners/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const next = { apiKey: result.partner.apiKey, apiSecret: result.partner.apiSecret };
      setCreds(next);
      setPartnerCreds(next);
      setMsg("Partner created and credentials saved.");
    } catch (error) {
      setErr(error.message);
    }
  };

  const loginPartner = async () => {
    try {
      setErr("");
      const result = await request("/api/v1/partners/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm)
      });
      const next = { apiKey: loginForm.apiKey, apiSecret: loginForm.apiSecret };
      setCreds(next);
      setPartnerCreds(next);
      setMsg(`Logged in as ${result.partner.name}. Credentials saved.`);
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <section className="space-y-4">
      <article className="card">
        <h2 className="mb-2 text-lg font-bold">Integration Guide</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Create your partner profile.</li>
          <li>Existing partners can login with existing API credentials.</li>
          <li>Store API credentials on your backend only.</li>
          <li>Register users automatically by phone from your platform.</li>
          <li>Send signed bet events on every bet placed.</li>
        </ol>
      </article>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="card">
          <h3 className="mb-3 text-base font-bold">Existing Partner Login</h3>
          <label className="label">API Key</label>
          <input
            className="input"
            value={loginForm.apiKey}
            onChange={(e) => setLoginForm({ ...loginForm, apiKey: e.target.value })}
          />
          <label className="label">API Secret</label>
          <input
            className="input"
            value={loginForm.apiSecret}
            onChange={(e) => setLoginForm({ ...loginForm, apiSecret: e.target.value })}
          />
          <button className="btn-secondary mt-2" onClick={loginPartner}>
            Login Partner
          </button>
        </article>

        <article className="card">
          <h3 className="mb-3 text-base font-bold">Create Partner</h3>
          <label className="label">Partner Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label className="label">Webhook URL</label>
          <input
            className="input"
            value={form.webhookUrl}
            onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
          />
          <button className="btn mt-2" onClick={createPartner}>
            Create Partner
          </button>
          {msg && <p className="mt-2 text-sm font-semibold text-emerald-700">{msg}</p>}
          {err && <p className="mt-2 text-sm font-semibold text-red-700">{err}</p>}
        </article>

        <article className="card">
          <h3 className="mb-3 text-base font-bold">Credentials</h3>
          <label className="label">API Key</label>
          <input className="input" value={creds.apiKey} readOnly />
          <label className="label">API Secret</label>
          <input className="input" value={creds.apiSecret} readOnly />
        </article>
      </div>
    </section>
  );
}
