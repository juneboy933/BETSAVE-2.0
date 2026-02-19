"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getApiBase, request, setApiBase, setPartnerCreds, setPartnerName } from "../../lib/api";

export default function PartnerRegisterPage() {
  const router = useRouter();
  const [apiBase, setApiBaseInput] = useState("");
  const [form, setForm] = useState({ name: "", webhookUrl: "" });
  const [error, setError] = useState("");

  useEffect(() => setApiBaseInput(getApiBase()), []);

  const onRegister = async () => {
    try {
      setError("");
      const result = await request("/api/v1/partners/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      setPartnerCreds({ apiKey: result.partner.apiKey, apiSecret: result.partner.apiSecret });
      setPartnerName(result.partner?.name || form.name);
      sessionStorage.setItem(
        "partner_security_notice",
        result.securityNotice ||
          "Store your API key and API secret securely in your backend secret manager."
      );
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="auth-shell">
      <header className="nav-shell">
        <Link href="/" className="brand-lockup">
          <div className="brand-logo">B</div>
          <div>
            <p className="brand-title">Betsave</p>
            <p className="brand-subtitle">Partner Registration</p>
          </div>
        </Link>
      </header>

      <main className="auth-main">
        <article className="auth-card">
          <h1 className="text-3xl font-bold text-slate-900">Register Partner</h1>
          <p className="mt-2 text-sm text-slate-600">
            Already registered? <Link className="font-semibold text-brand" href="/login">Login here</Link>.
          </p>
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            Store your API key and API secret securely after registration. Never expose them in frontend code.
          </p>

          <label className="label">Backend API URL</label>
          <div className="flex flex-wrap gap-2">
            <input className="input flex-1" value={apiBase} onChange={(e) => setApiBaseInput(e.target.value)} />
            <button className="btn" onClick={() => setApiBase(apiBase)}>
              Save URL
            </button>
          </div>

          <label className="label">Partner Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

          <label className="label">Webhook URL</label>
          <input
            className="input"
            value={form.webhookUrl}
            onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn" onClick={onRegister}>
              Register
            </button>
            <Link href="/login" className="btn-secondary">
              Go To Login
            </Link>
          </div>

          {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        </article>
      </main>

      <footer className="site-footer">Betsave Partner Portal</footer>
    </section>
  );
}
