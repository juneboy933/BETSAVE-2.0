"use client";

import { useEffect, useState } from "react";
import { getAdminToken, getApiBase, request, setAdminToken, setApiBase } from "../../lib/api";

export default function AccessPage() {
  const [apiBase, setApiBaseInput] = useState("");
  const [registerForm, setRegisterForm] = useState({ name: "", email: "", password: "" });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setApiBaseInput(getApiBase());
    setToken(getAdminToken());
  }, []);

  const doRegister = async () => {
    try {
      setErr("");
      const result = await request("/api/v1/admin/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerForm)
      });
      setAdminToken(result.token);
      setToken(result.token);
      setMsg("Admin registered and token saved.");
    } catch (error) {
      setErr(error.message);
    }
  };

  const doLogin = async () => {
    try {
      setErr("");
      const result = await request("/api/v1/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm)
      });
      setAdminToken(result.token);
      setToken(result.token);
      setMsg("Admin logged in and token saved.");
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
          <h3 className="mb-3 text-base font-bold">Register Admin</h3>
          <label className="label">Name</label>
          <input className="input" value={registerForm.name} onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })} />
          <label className="label">Email</label>
          <input className="input" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} />
          <label className="label">Password</label>
          <input className="input" type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} />
          <button className="btn mt-2" onClick={doRegister}>
            Register
          </button>
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
        <h3 className="mb-2 text-base font-bold">Saved Admin Token</h3>
        <p className="break-all text-sm text-slate-700">{token || "No token saved yet."}</p>
      </article>
      {msg && <p className="text-sm font-semibold text-emerald-700">{msg}</p>}
      {err && <p className="text-sm font-semibold text-red-700">{err}</p>}
    </section>
  );
}
