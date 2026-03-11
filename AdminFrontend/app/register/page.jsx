"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getApiBase, request, setAdminToken, setApiBase } from "../../lib/api";

export default function AdminRegisterPage() {
  const router = useRouter();
  const [apiBase, setApiBaseInput] = useState("");
  const [form, setForm] = useState({ invitationCode: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => setApiBaseInput(getApiBase()), []);

  const onRegister = async () => {
    try {
      setError("");
      setLoading(true);

      if (!form.invitationCode.trim()) {
        setError("Invitation code is required");
        setLoading(false);
        return;
      }
      if (form.password.length < 8) {
        setError("Password must be at least 8 characters");
        setLoading(false);
        return;
      }

      const result = await request("/api/v1/admin/auth/register-with-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      setAdminToken(result.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
          <p className="mt-3 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900">
            Admins can only register using an invitation code from an existing admin.
          </p>

          <label className="label">Backend API URL</label>
          <div className="flex flex-wrap gap-2">
            <input className="input flex-1" value={apiBase} onChange={(e) => setApiBaseInput(e.target.value)} />
            <button className="btn" onClick={() => setApiBase(apiBase)}>
              Save URL
            </button>
          </div>

          <label className="label">Invitation Code</label>
          <input 
            className="input" 
            placeholder="Paste the invitation code from your admin"
            value={form.invitationCode} 
            onChange={(e) => setForm({ ...form, invitationCode: e.target.value })} 
          />

          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn" onClick={onRegister} disabled={loading}>
              {loading ? "Registering..." : "Register"}
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
