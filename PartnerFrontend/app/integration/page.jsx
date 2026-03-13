"use client";

export default function IntegrationPage() {
  return (
    <section className="space-y-4">
      <article className="card">
        <h2 className="mb-2 text-lg font-bold">Integration Guide</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Register the partner through the email/password flow.</li>
          <li>Capture the API key and secret shown once after registration.</li>
          <li>Store API credentials on your backend only.</li>
          <li>Register users automatically by phone from your platform.</li>
          <li>Send signed bet events on every bet placed.</li>
        </ol>
      </article>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="card">
          <h3 className="mb-3 text-base font-bold">Credential Handling</h3>
          <p className="text-sm text-slate-600">
            The partner portal no longer keeps API secrets in shared browser state. Registration shows them once, and
            after that your backend is the only supported place to retain them.
          </p>
          <div className="mt-4 rounded-xl bg-slate-100 p-3 font-mono text-xs">
            <p className="mb-2 font-semibold text-slate-700">Dashboard Access</p>
            <p className="mb-3 break-all rounded bg-white px-2 py-1 text-slate-900">Session cookie only</p>
            <p className="mb-2 font-semibold text-slate-700">Integration Signing</p>
            <p className="break-all rounded bg-white px-2 py-1 text-slate-900">Server-to-server only</p>
          </div>
        </article>

        <article className="card">
          <h3 className="mb-3 text-base font-bold">What Changed</h3>
          <p className="text-sm leading-6 text-slate-600">
            Legacy browser endpoints that created partners or re-logged them with API secrets were removed from the
            normal UI path. That flow was weak and encouraged secret handling in the browser.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Use dashboard email/password auth for operator access. Use API key plus API secret only from your backend
            when signing integration requests.
          </p>
        </article>
      </div>
    </section>
  );
}
