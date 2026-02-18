import Link from "next/link";

export default function AdminHomePage() {
  return (
    <section className="public-shell">
      <header className="nav-shell">
        <div className="brand-lockup">
          <div className="brand-logo">B</div>
          <div>
            <p className="brand-title">Betsave</p>
            <p className="brand-subtitle">Admin Portal</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/register" className="btn">
            Register
          </Link>
          <Link href="/login" className="btn-secondary">
            Login
          </Link>
        </div>
      </header>

      <main className="public-main">
        <article className="public-center">
          <h1 className="public-headline">Manage Betsave Operations With Confidence</h1>
          <p className="public-tagline">
            Oversee partners, users, events, and savings performance in a single trusted workspace built for governance,
            financial visibility, and platform growth.
          </p>
          <div className="public-actions">
            <Link href="/register" className="btn">
              Create Admin Account
            </Link>
            <Link href="/login" className="btn-secondary">
              Sign In
            </Link>
          </div>
        </article>
      </main>

      <footer className="site-footer">Betsave Admin Portal</footer>
    </section>
  );
}
