"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import QuickActionsPanel from "./QuickActionsPanel";

const navItems = [
  { name: "Start", href: "/start" },
  { name: "Mój profil", href: "/profil" },
  { name: "Agent", href: "/agent" },
  { name: "Plan", href: "/settings/subscription" },
  { name: "Warsztaty", href: "/programy" },
  { name: "Skarbiec", href: "/skarbiec" },
  { name: "Na żywo", href: "/na-zywo" },
  { name: "Społeczność", href: "/spolecznosc" },
  { name: "Ludzie", href: "/ludzie" },
  { name: "O Akademii", href: "/o-akademii" },
];

const pathAliases: Record<string, string[]> = {
  "/programy": ["/programy", "/classroom"],
  "/na-zywo": ["/na-zywo", "/calendar"],
  "/spolecznosc": ["/spolecznosc", "/community"],
  "/ludzie": ["/ludzie", "/members"],
  "/o-akademii": ["/o-akademii", "/about"],
};

function isActivePath(pathname: string, href: string) {
  if (href === "/start") {
    return pathname === "/start";
  }

  const paths = pathAliases[href] ?? [href];
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-border bg-[color:var(--card)] px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/start" className="flex items-center gap-3">
              <div className="soft-ring flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--muted-gold))] text-sm font-extrabold text-white">
                AI
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground/80">
                  Akademia AI
                </p>
              </div>
            </Link>
          </div>

          <nav className="hidden items-center gap-1 rounded-full border border-border/80 bg-background/50 p-1 lg:flex">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${
                    active
                      ? "bg-foreground text-background"
                      : "text-foreground/55 hover:text-foreground"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/60 text-foreground/55 transition-colors hover:text-foreground"
              title={theme === "light" ? "Tryb ciemny" : "Tryb jasny"}
            >
              {theme === "light" ? (
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
              ) : (
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
              )}
            </button>

            {user && (
              <button
                className="flex h-10 min-w-10 items-center justify-center rounded-full bg-accent px-3 text-xs font-bold text-white"
                onClick={logout}
                title="Wyloguj"
              >
                <span className="sm:hidden">{user.name.charAt(0).toUpperCase()}</span>
                <span className="hidden sm:block">Wyjdź</span>
              </button>
            )}
          </div>
        </div>

        <div className="mx-auto mt-3 flex max-w-7xl gap-2 overflow-x-auto pb-1 lg:hidden">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-[color:var(--card)] text-foreground/60"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>
      </header>

      <QuickActionsPanel />
    </>
  );
}
