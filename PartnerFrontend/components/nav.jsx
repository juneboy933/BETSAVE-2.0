"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/integration", label: "Integration" },
  { href: "/users", label: "Users" },
  { href: "/events", label: "Events" },
  { href: "/analytics", label: "Analytics" }
];

export default function Nav() {
  const path = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {links.map((link) => {
        const active = path === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              active
                ? "bg-brand text-white shadow-md shadow-brand/25"
                : "bg-white/90 text-slate-700 border border-slate-200 hover:border-slate-300"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
