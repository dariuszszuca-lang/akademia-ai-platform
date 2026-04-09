"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";

const tabs = [
  { name: "Społeczność", href: "/community" },
  { name: "Materiały", href: "/classroom" },
  { name: "Kalendarz", href: "/calendar" },
  { name: "Członkowie", href: "/members" },
  { name: "O nas", href: "/about" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top row */}
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <span className="text-gold font-heading font-bold text-sm">A</span>
            </div>
            <h1 className="font-heading text-lg font-semibold text-foreground tracking-wide">
              Akademia AI
            </h1>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-lg bg-slate-light flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors"
              title={theme === "light" ? "Tryb ciemny" : "Tryb jasny"}
            >
              {theme === "light" ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
              )}
            </button>

            {user && (
              <>
                <button
                  onClick={logout}
                  className="text-sm text-foreground/50 hover:text-foreground transition-colors"
                >
                  Wyloguj
                </button>
                <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-semibold text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-gold text-foreground"
                    : "border-transparent text-foreground/50 hover:text-foreground hover:border-foreground/20"
                }`}
              >
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
