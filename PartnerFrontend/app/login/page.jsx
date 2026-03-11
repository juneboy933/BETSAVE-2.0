"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getApiBase, setApiBase, loginPartnerAuth } from "../../lib/api";

export default function PartnerLoginPage() {
  const router = useRouter();
  const [apiBase, setApiBaseInput] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setApiBaseInput(getApiBase());
  }, []);

  const onLogin = async () => {
    try {
      setError("");
      setLoading(true);

      // Validate
      if (!form.email.trim()) {
        setError("Email is required");
        return;
      }
      if (!form.password) {
        setError("Password is required");
        return;
      }

      await loginPartnerAuth({
        email: form.email,
        password: form.password
      });

      // Redirect to dashboard on success
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Allow Enter key to submit
  const onKeyPress = (e) => {
    if (e.key === "Enter" && !loading) {
      onLogin();
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
          <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
            ✓ Login with your email and password. Your API credentials are used on your backend only.
          </p>

          <label className="label">Backend API URL</label>
          <div className="flex flex-wrap gap-2">
            <input className="input flex-1" value={apiBase} onChange={(e) => setApiBaseInput(e.target.value)} />
            <button className="btn" onClick={() => setApiBase(apiBase)}>
              Save URL
            </button>
          </div>

          <label className="label">Email</label>
          <input 
            className="input" 
            type="email"
            placeholder="your@company.com"
            value={form.email} 
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            onKeyPress={onKeyPress}
          />

          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            placeholder="Your password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            onKeyPress={onKeyPress}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <button 
              className="btn" 
              onClick={onLogin}
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
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
