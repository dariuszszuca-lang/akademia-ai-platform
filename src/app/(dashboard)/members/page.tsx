"use client";

import { useAuth } from "@/lib/auth-context";

export default function MembersPage() {
  const { user } = useAuth();

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <h2 className="font-heading text-4xl font-bold text-foreground tracking-wide gold-glow-text">
          Członkowie
        </h2>
        <p className="text-sm text-foreground/35 mt-2 font-light tracking-wide">Uczestnicy Akademii AI</p>
        <div className="w-24 h-px bg-gradient-to-r from-gold to-transparent mt-4" />
      </div>

      {/* Search */}
      <div className="mb-8 max-w-md relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder="Szukaj członków..."
          className="w-full bg-card border border-border pl-11 pr-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-gold/20 focus:border-gold/30 transition-all placeholder:text-foreground/20"
          style={{ borderRadius: "0" }}
        />
      </div>

      {/* Members grid — horizontal cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger-children">
        {user && (
          <div className="member-card cursor-pointer group">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div
                className="w-14 h-14 flex items-center justify-center text-lg font-semibold"
                style={{
                  background: "rgba(201, 160, 48, 0.12)",
                  color: "#C9A030",
                  borderRadius: "0",
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              {/* Online dot */}
              <span
                className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2"
                style={{ borderColor: "var(--card)", borderRadius: "0" }}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-medium text-sm text-foreground group-hover:text-gold transition-colors truncate">
                  {user.name}
                </p>
              </div>
              <p className="text-[11px] text-foreground/25 truncate">{user.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5"
                  style={{ background: "rgba(201, 160, 48, 0.08)", color: "#C9A030" }}
                >
                  Admin
                </span>
                <span className="flex items-center gap-1 text-[10px] text-foreground/20">
                  <span className="w-1.5 h-1.5 bg-green-500" style={{ borderRadius: "0" }} />
                  Online
                </span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5"
                  style={{ background: "rgba(201, 160, 48, 0.1)", color: "#C9A030" }}
                >
                  Lv. 7
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Placeholder cards for visual effect */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="member-card opacity-30 cursor-default">
            <div
              className="w-14 h-14 flex-shrink-0 flex items-center justify-center"
              style={{
                background: "var(--slate-light)",
                borderRadius: "0",
              }}
            >
              <svg className="w-6 h-6 text-foreground/15" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="h-3 w-24 bg-slate-light mb-2" />
              <div className="h-2 w-16 bg-slate-light" />
            </div>
          </div>
        ))}
      </div>

      {/* Invite hint */}
      <div className="mt-10 text-center py-8 border-t border-border/50">
        <p className="text-sm text-foreground/20 font-light">Zaproś uczestników aby powiększyć społeczność</p>
      </div>
    </div>
  );
}
