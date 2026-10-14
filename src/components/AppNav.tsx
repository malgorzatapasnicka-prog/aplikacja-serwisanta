"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKI = [
  { href: "/", label: "Pulpit" },
  { href: "/klienci", label: "Klienci" },
  { href: "/zlecenia", label: "Zlecenia" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <aside className="border-b border-stone-800 bg-stone-950 text-stone-100 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
      <div className="px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-400">
          Serwis
        </p>
        <p className="mt-1 text-lg font-semibold tracking-tight">CRM serwisanta</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-4 md:flex-col md:overflow-visible md:pb-6">
        {LINKI.map((link) => {
          const aktywny = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                aktywny
                  ? "bg-white/10 text-white"
                  : "text-stone-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
