"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getApiBase, setApiBase, setPartnerName, registerPartnerAuth } from "../../lib/api";

export default function PartnerRegisterPage() {
  const router = useRouter();
  const [apiBase, setApiBaseInput] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", webhookUrl: "" });
  const [error, setError] = useState("");
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setApiBaseInput(getApiBase()), []);

  const onRegister = async () => {
    try {
      setError("");
      setLoading(true);

      // Validate
      if (!form.name.trim()) {
        setError("Partner name is required");
        return;
      }
      if (!form.email.trim()) {
        setError("Email is required");
        return;
      }
      if (form.password.length < 10) {
        setError("Password must be at least 10 characters");
        return;
      }

      const result = await registerPartnerAuth({
        name: form.name,
        email: form.email,
        password: form.password,
        webhookUrl: form.webhookUrl
      });

      // Store credentials for display (one-time only)
      setCredentials(result.credentials);
      setShowCredentials(true);

      // Save partner name
      setPartnerName(result.partner?.name || form.name);

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const onContinueToDashboard = () => {
    router.push("/dashboard");
  };

  if (showCredentials && credentials) {
    return (
      <section className="auth-shell">
        <header className="nav-shell">
          <Link href="/" className="brand-lockup">
            <div className="brand-logo">B</div>
            <div>
              <p className="brand-title">Betsave</p>
              <p className="brand-subtitle">Registration Success</p>
            </div>
          </Link>
        </header>

        <main className="auth-main">
          <article className="auth-card">
            <h1 className="text-3xl font-bold text-slate-900">Account Created! 🎉</h1>
            <p className="mt-2 text-sm text-slate-600">
              Your partner account is ready. Save your API credentials now—we won't show them again.
            </p>

            <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-900">⚠️ CRITICAL: Save These Now</p>
              <p className="mt-1 text-xs text-red-800">
                Copy your API Key and Secret to your backend's secret manager. If you lose them, you'll need to regenerate.
              </p>
            </div>

            <div className="mt-4 rounded-lg bg-slate-100 p-3 font-mono text-xs">
              <p className="mb-2 font-semibold text-slate-700">API Key:</p>
              <p className="mb-3 break-all rounded bg-slate-50 px-2 py-1 text-slate-900">{credentials.apiKey}</p>

              <p className="mb-2 font-semibold text-slate-700">API Secret:</p>
              <p className="mb-3 break-all rounded bg-slate-50 px-2 py-1 text-slate-900">{credentials.apiSecret}</p>

              <p className="mb-2 font-semibold text-slate-700">Operating Mode:</p>
              <p className="break-all rounded bg-slate-50 px-2 py-1 text-slate-900">{credentials.operatingMode || "demo"}</p>
            </div>

            <button
              className="mt-4 w-full rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(credentials, null, 2));
                alert("Credentials copied to clipboard. Store them safely!");
              }}
            >
              Copy All Credentials
            </button>

            <button
              className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
              onClick={onContinueToDashboard}
            >
              Continue to Dashboard
            </button>

            <p className="mt-4 text-xs text-slate-600">
              Next: Use your API Key and Secret to sign requests from your backend. Never expose them in frontend code.
            </p>
          </article>
        </main>

        <footer className="site-footer">Betsave Partner Portal</footer>
      </section>
    );
  }

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
          <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
            ✓ Email and password authentication. Your API credentials are generated once and shown after registration.
          </p>

          <label className="label">Backend API URL</label>
          <div className="flex flex-wrap gap-2">
            <input className="input flex-1" value={apiBase} onChange={(e) => setApiBaseInput(e.target.value)} />
            <button className="btn" onClick={() => setApiBase(apiBase)}>
              Save URL
            </button>
          </div>

          <label className="label">Partner Name</label>
          <input 
            className="input" 
            placeholder="Your organization name"
            value={form.name} 
            onChange={(e) => setForm({ ...form, name: e.target.value })} 
          />

          <label className="label">Email</label>
          <input 
            className="input" 
            type="email"
            placeholder="your@company.com"
            value={form.email} 
            onChange={(e) => setForm({ ...form, email: e.target.value })} 
          />

          <label className="label">Password</label>
          <input 
            className="input" 
            type="password"
            placeholder="At least 10 characters"
            value={form.password} 
            onChange={(e) => setForm({ ...form, password: e.target.value })} 
          />

          <label className="label">Webhook URL (Optional)</label>
          <input
            className="input"
            type="url"
            placeholder="https://your-backend.com/webhook"
            value={form.webhookUrl}
            onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <button 
              className="btn" 
              onClick={onRegister}
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Register"}
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
