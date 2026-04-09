"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const tabs = [
  { name: "Community", href: "/community" },
  { name: "Classroom", href: "/classroom" },
  { name: "Calendar", href: "/calendar" },
  { name: "Members", href: "/members" },
  { name: "About", href: "/about" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top row */}
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <span className="text-gold font-heading font-bold text-sm">A</span>
            </div>
            <h1 className="font-heading text-lg font-semibold text-navy tracking-wide">
              Akademia AI
            </h1>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {user && (
              <>
                <button
                  onClick={logout}
                  className="text-sm text-gray-500 hover:text-navy transition-colors"
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
                    ? "border-gold text-navy"
                    : "border-transparent text-gray-500 hover:text-navy hover:border-gray-300"
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
