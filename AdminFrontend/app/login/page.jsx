"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getApiBase, request, setAdminToken, setApiBase } from "../../lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [apiBase, setApiBaseInput] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  useEffect(() => setApiBaseInput(getApiBase()), []);

  const onLogin = async () => {
    try {
      setError("");
      const result = await request("/api/v1/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      setAdminToken(result.token);
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
            <p className="brand-subtitle">Admin Login</p>
          </div>
        </Link>
      </header>

      <main className="auth-main">
        <article className="auth-card">
          <h1 className="text-3xl font-bold text-slate-900">Login Admin</h1>
          <p className="mt-2 text-sm text-slate-600">
            Need an account? <Link className="font-semibold text-brand" href="/register">Register here</Link>.
          </p>

          <label className="label">Backend API URL</label>
          <div className="flex flex-wrap gap-2">
            <input className="input flex-1" value={apiBase} onChange={(e) => setApiBaseInput(e.target.value)} />
            <button className="btn" onClick={() => setApiBase(apiBase)}>
              Save URL
            </button>
          </div>

          <label className="label">Email</label>
          <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
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

      <footer className="site-footer">Betsave Admin Portal</footer>
    </section>
  );
}
