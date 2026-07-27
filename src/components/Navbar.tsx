"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  PRODUCT_NAME,
  PRODUCT_NAVIGATION,
  isProductPathActive,
} from "@/lib/product";

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Zamykanie dropdown gdy klikniemy poza nim albo wciśniemy Escape
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuPath(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuPath(null);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
      <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-border bg-[color:var(--card)] px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/start" className="flex items-center gap-3">
              <div className="soft-ring flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--muted-gold))] text-sm font-extrabold text-white">
                PI
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground/80">
                  {PRODUCT_NAME}
                </p>
              </div>
            </Link>
          </div>

          <nav className="hidden items-center gap-1 rounded-full border border-border/80 bg-background/50 p-1 lg:flex">
            {PRODUCT_NAVIGATION.map((item) => {
              const active = isProductPathActive(pathname, item.href);

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
            {user && (
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuPath(menuOpen ? null : pathname)}
                  className="flex items-center gap-2.5 rounded-full border border-border bg-background/40 py-1.5 pl-1.5 pr-3 transition-colors hover:bg-background/60"
                  title={user.email}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--muted-gold))] text-xs font-bold text-white">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[120px] truncate text-sm text-foreground/80 sm:block">
                    {user.name || user.email}
                  </span>
                  <svg
                    className={`hidden h-3.5 w-3.5 text-foreground/50 transition-transform sm:block ${menuOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border border-border bg-[color:var(--card-strong)] shadow-[var(--shadow-soft)]"
                    role="menu"
                  >
                    <div className="border-b border-border/60 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {user.name || "—"}
                      </p>
                      <p className="truncate text-xs text-foreground/55">{user.email}</p>
                    </div>
                    <div className="py-1.5">
                      <Link
                        href="/profil"
                        className="block px-4 py-2 text-sm text-foreground/80 transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                        role="menuitem"
                      >
                        Mój profil
                      </Link>
                      <Link
                        href="/settings"
                        className="block px-4 py-2 text-sm text-foreground/80 transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                        role="menuitem"
                      >
                        Ustawienia
                      </Link>
                      <Link
                        href="/onboarding"
                        className="block px-4 py-2 text-sm text-foreground/80 transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                        role="menuitem"
                      >
                        Onboarding AI
                      </Link>
                    </div>
                    <div className="border-t border-border/60 py-1.5">
                      <button
                        onClick={() => {
                          setMenuPath(null);
                          logout();
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-foreground/70 transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                        role="menuitem"
                      >
                        Wyloguj
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto mt-3 flex max-w-7xl gap-2 overflow-x-auto pb-1 lg:hidden">
          {PRODUCT_NAVIGATION.map((item) => {
            const active = isProductPathActive(pathname, item.href);

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
  );
}
