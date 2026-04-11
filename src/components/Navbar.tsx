"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useState } from "react";

const navItems = [
  {
    name: "Społeczność",
    href: "/community",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
  },
  {
    name: "Materiały",
    href: "/classroom",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    name: "Kalendarz",
    href: "/calendar",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    name: "Członkowie",
    href: "/members",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    name: "O nas",
    href: "/about",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
      </svg>
    ),
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Left Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out ${
          collapsed ? "w-[72px]" : "w-[260px]"
        }`}
        style={{ background: "var(--sidebar-bg)" }}
      >
        {/* Logo area */}
        <div className={`flex items-center h-16 px-4 ${collapsed ? "justify-center" : "gap-3"}`}>
          <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center" style={{ borderLeft: "2px solid #C9A030" }}>
            <span className="text-white font-heading font-bold text-sm tracking-wider pl-2">AI</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <h1 className="font-heading text-[13px] font-semibold text-white tracking-[0.2em] uppercase leading-tight truncate">
                Akademia AI
              </h1>
              <span className="text-[10px] tracking-wider uppercase leading-tight truncate" style={{ color: "var(--sidebar-fg)" }}>
                Platforma
              </span>
            </div>
          )}
        </div>

        {/* Thin gold line separator */}
        <div className="mx-4 h-px" style={{ background: "linear-gradient(90deg, #C9A030, transparent)" }} />

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {!collapsed && (
            <p className="px-7 mb-2 text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--sidebar-fg)", opacity: 0.5 }}>
              Menu
            </p>
          )}
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-item ${isActive ? "active" : ""} ${collapsed ? "!justify-center !px-0 !mx-2" : ""}`}
                title={collapsed ? item.name : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto pb-4">
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`sidebar-nav-item ${collapsed ? "!justify-center !px-0 !mx-2" : ""}`}
            title={collapsed ? "Rozwiń" : "Zwiń"}
          >
            <svg
              className={`w-[18px] h-[18px] flex-shrink-0 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
            {!collapsed && <span>Zwiń panel</span>}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className={`sidebar-nav-item ${collapsed ? "!justify-center !px-0 !mx-2" : ""}`}
            title={theme === "light" ? "Tryb ciemny" : "Tryb jasny"}
          >
            {theme === "light" ? (
              <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
            ) : (
              <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
              </svg>
            )}
            {!collapsed && <span>{theme === "light" ? "Tryb ciemny" : "Tryb jasny"}</span>}
          </button>

          {/* Thin line */}
          <div className="mx-4 my-3 h-px" style={{ background: "var(--border)" }} />

          {/* User */}
          {user && (
            <div className={`px-4 ${collapsed ? "flex justify-center" : ""}`}>
              <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-sm font-semibold" style={{
                  background: "rgba(201, 160, 48, 0.15)",
                  color: "#C9A030",
                  borderRadius: "0",
                }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{user.name}</p>
                    <button
                      onClick={logout}
                      className="text-[10px] hover:text-white transition-colors"
                      style={{ color: "var(--sidebar-fg)" }}
                    >
                      Wyloguj
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Spacer for main content */}
      <div
        className={`flex-shrink-0 transition-all duration-300 ${collapsed ? "w-[72px]" : "w-[260px]"}`}
      />
    </>
  );
}
