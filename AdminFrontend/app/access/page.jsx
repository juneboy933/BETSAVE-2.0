"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiBase, hasAdminToken, request, setAdminToken, setApiBase } from "../../lib/api";

export default function AccessPage() {
  const [apiBase, setApiBaseInput] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setApiBaseInput(getApiBase());
  }, []);

  const doLogin = async () => {
    try {
      setErr("");
      const result = await request("/api/v1/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm)
      });
      setAdminToken(result.token);
      setMsg("Admin session established.");
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <section className="space-y-4">
      <article className="card">
        <h2 className="mb-3 text-lg font-bold">Access Setup</h2>
        <label className="label">Backend API URL</label>
        <input className="input" value={apiBase} onChange={(e) => setApiBaseInput(e.target.value)} />
        <button className="btn mt-2" onClick={() => setApiBase(apiBase)}>
          Save API URL
        </button>
      </article>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="card">
          <h3 className="mb-3 text-base font-bold">Admin Onboarding</h3>
          <p className="text-sm leading-6 text-slate-600">
            Admin registration is invitation-only. An existing admin must log in, open Dashboard Access, create an
            invitation, then send the one-time code to the invited admin.
          </p>
          <Link href="/register" className="btn mt-4">
            Open Invitation Registration
          </Link>
        </article>

        <article className="card">
          <h3 className="mb-3 text-base font-bold">Login Admin</h3>
          <label className="label">Email</label>
          <input className="input" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} />
          <label className="label">Password</label>
          <input className="input" type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
          <button className="btn mt-2" onClick={doLogin}>
            Login
          </button>
        </article>
      </div>

      <article className="card">
        <h3 className="mb-2 text-base font-bold">Session Status</h3>
        <p className="break-all text-sm text-slate-700">{hasAdminToken() ? "Admin session active." : "No admin session active."}</p>
      </article>
      {msg && <p className="text-sm font-semibold text-emerald-700">{msg}</p>}
      {err && <p className="text-sm font-semibold text-red-700">{err}</p>}
    </section>
  );
}
