"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";

const navItems = [
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
    <header
      className="fixed top-0 left-0 right-0 z-40 border-b border-border"
      style={{
        background: theme === "dark" ? "rgba(17, 17, 17, 0.95)" : "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/community" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent text-white font-extrabold text-sm">
              AI
            </div>
            <span className="text-sm font-bold text-foreground tracking-tight hidden sm:inline">
              Akademia AI
            </span>
          </Link>

          {/* Center navigation — Skool-style text tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-4 py-4 text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? "text-accent"
                      : "text-foreground/50 hover:text-foreground/80"
                  }`}
                >
                  {item.name}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-accent" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Mobile nav — text only, compact */}
          <nav className="flex md:hidden items-center gap-0 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-2.5 py-4 text-xs font-medium whitespace-nowrap transition-colors duration-200 ${
                    isActive
                      ? "text-accent"
                      : "text-foreground/40 hover:text-foreground/70"
                  }`}
                >
                  {item.name}
                  {isActive && (
                    <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-accent" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right side — theme toggle + user */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground/40 hover:text-accent hover:bg-accent-light transition-colors"
              title={theme === "light" ? "Tryb ciemny" : "Tryb jasny"}
            >
              {theme === "light" ? (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
              )}
            </button>

            {user && (
              <button
                className="w-8 h-8 flex items-center justify-center text-xs font-bold rounded-full cursor-pointer bg-accent/15 text-accent hover:bg-accent/25 transition-all"
                onClick={logout}
                title="Wyloguj"
              >
                {user.name.charAt(0).toUpperCase()}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
