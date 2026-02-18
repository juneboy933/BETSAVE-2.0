import Link from "next/link";

export default function PartnerHomePage() {
  return (
    <section className="public-shell">
      <header className="nav-shell">
        <div className="brand-lockup">
          <div className="brand-logo">B</div>
          <div>
            <p className="brand-title">Betsave</p>
            <p className="brand-subtitle">Partner Portal</p>
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
          <h1 className="public-headline">Automate User Savings From Every Bet Event</h1>
          <p className="public-tagline">
            Integrate your platform with Betsave, register users by phone number, and monitor event-level savings and
            total growth through a reliable partner dashboard.
          </p>
          <div className="public-actions">
            <Link href="/register" className="btn">
              Create Partner Account
            </Link>
            <Link href="/login" className="btn-secondary">
              Sign In
            </Link>
          </div>
        </article>
      </main>

      <footer className="site-footer">Betsave Partner Portal</footer>
    </section>
  );
}
