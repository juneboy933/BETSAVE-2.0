"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getApiBase, request, setApiBase, setPartnerCreds } from "../../lib/api";

export default function PartnerLoginPage() {
  const router = useRouter();
  const [apiBase, setApiBaseInput] = useState("");
  const [form, setForm] = useState({ apiKey: "", apiSecret: "" });
  const [error, setError] = useState("");

  useEffect(() => setApiBaseInput(getApiBase()), []);

  const onLogin = async () => {
    try {
      setError("");
      const result = await request("/api/v1/partners/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      setPartnerCreds(form);
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
            <p className="brand-subtitle">Partner Login</p>
          </div>
        </Link>
      </header>

      <main className="auth-main">
        <article className="auth-card">
          <h1 className="text-3xl font-bold text-slate-900">Login Partner</h1>
          <p className="mt-2 text-sm text-slate-600">
            New here? <Link className="font-semibold text-brand" href="/register">Create your account</Link>.
          </p>
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            Keep your API credentials secure. Store them only on your backend and secret manager.
          </p>

          <label className="label">Backend API URL</label>
          <div className="flex flex-wrap gap-2">
            <input className="input flex-1" value={apiBase} onChange={(e) => setApiBaseInput(e.target.value)} />
            <button className="btn" onClick={() => setApiBase(apiBase)}>
              Save URL
            </button>
          </div>

          <label className="label">API Key</label>
          <input className="input" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />

          <label className="label">API Secret</label>
          <input
            className="input"
            value={form.apiSecret}
            onChange={(e) => setForm({ ...form, apiSecret: e.target.value })}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn" onClick={onLogin}>
              Login
            </button>
            <Link href="/register" className="btn-secondary">
              Go To Register
            </Link>
          </div>

          {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        </article>
      </main>

      <footer className="site-footer">Betsave Partner Portal</footer>
    </section>
  );
}
