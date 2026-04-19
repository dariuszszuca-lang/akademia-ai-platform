"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";

const navItems = [
  { name: "Start", href: "/start" },
  { name: "Warsztaty", href: "/programy" },
  { name: "Skarbiec", href: "/skarbiec" },
  { name: "Na żywo", href: "/na-zywo" },
  { name: "Agent", href: "/agent" },
  { name: "Społeczność", href: "/spolecznosc" },
  { name: "Ludzie", href: "/ludzie" },
  { name: "O Akademii", href: "/o-akademii" },
];

const quickActions = [
  {
    name: "Agent",
    note: "Uruchom zadanie",
    href: "/agent",
    tone: "from-[color:var(--accent)] to-[color:var(--aqua)]",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.091-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.091L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.091 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.091Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.25 8.25 18 9.25l-.25-1a2 2 0 0 0-1.5-1.5l-1-.25 1-.25a2 2 0 0 0 1.5-1.5l.25-1 .25 1a2 2 0 0 0 1.5 1.5l1 .25-1 .25a2 2 0 0 0-1.5 1.5Z" />
      </svg>
    ),
  },
  {
    name: "Tydzień",
    note: "Najbliższe live",
    href: "/na-zywo",
    tone: "from-[color:var(--muted-gold)] to-[color:var(--copper)]",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25m10.5-2.25v2.25M4.5 8.25h15m-13.5 12h12A2.25 2.25 0 0 0 20.25 18V6.75A2.25 2.25 0 0 0 18 4.5H6A2.25 2.25 0 0 0 3.75 6.75V18A2.25 2.25 0 0 0 6 20.25Z" />
      </svg>
    ),
  },
  {
    name: "Warsztat",
    note: "Wróć do ścieżki",
    href: "/programy",
    tone: "from-[color:var(--rose)] to-[color:var(--plum)]",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5V6.75A2.25 2.25 0 0 1 6.75 4.5h10.5A2.25 2.25 0 0 1 19.5 6.75V19.5l-7.5-3-7.5 3Z" />
      </svg>
    ),
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/start") {
    return pathname === "/start";
  }

  return pathname.startsWith(href);
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

      <div className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 xl:block">
        <div className="w-60 rounded-[28px] border border-border bg-[color:var(--card)] p-3 shadow-[var(--shadow-soft)] backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between px-2 pt-1">
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.22em] text-foreground/35">
                Centrum
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground/80">
                Szybka praca
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background/55 text-[color:var(--muted-gold)]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5M12 3.75v16.5" />
              </svg>
            </div>
          </div>

          <div className="grid gap-2">
          {quickActions.map((action) => (
            <Link
              key={action.href + action.name}
              href={action.href}
              title={action.name}
              className="group flex items-center gap-3 rounded-2xl border border-transparent p-2 transition-all hover:border-border hover:bg-background/60"
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${action.tone} text-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.65)]`}>
                {action.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5 text-foreground">
                  {action.name}
                </span>
                <span className="block truncate text-xs leading-5 text-foreground/45">
                  {action.note}
                </span>
              </span>
            </Link>
          ))}
          </div>

          <div className="mt-3 rounded-2xl border border-border bg-background/45 p-3">
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--muted-gold)]">
              Dzisiaj
            </p>
            <p className="mt-1 text-sm leading-5 text-foreground/70">
              Warsztat, live i agent są pod ręką.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
