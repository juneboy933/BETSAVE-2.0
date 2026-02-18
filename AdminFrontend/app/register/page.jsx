"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getApiBase, request, setAdminToken, setApiBase } from "../../lib/api";

export default function AdminRegisterPage() {
  const router = useRouter();
  const [apiBase, setApiBaseInput] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  useEffect(() => setApiBaseInput(getApiBase()), []);

  const onRegister = async () => {
    try {
      setError("");
      const result = await request("/api/v1/admin/auth/register", {
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
            <p className="brand-subtitle">Admin Registration</p>
          </div>
        </Link>
      </header>

      <main className="auth-main">
        <article className="auth-card">
          <h1 className="text-3xl font-bold text-slate-900">Register Admin</h1>
          <p className="mt-2 text-sm text-slate-600">
            Already registered? <Link className="font-semibold text-brand" href="/login">Login here</Link>.
          </p>

          <label className="label">Backend API URL</label>
          <div className="flex flex-wrap gap-2">
            <input className="input flex-1" value={apiBase} onChange={(e) => setApiBaseInput(e.target.value)} />
            <button className="btn" onClick={() => setApiBase(apiBase)}>
              Save URL
            </button>
          </div>

          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

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

      <footer className="site-footer">Betsave Admin Portal</footer>
    </section>
  );
}
