"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

const INVITE_LINK = "https://akademia-ai-platform.vercel.app/register/akademia-ai-2026-edycja1";

export default function MembersPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(INVITE_LINK);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
          Członkowie
        </h2>
        <p className="text-sm text-foreground/50 mt-1">Uczestnicy Akademii AI</p>
      </div>

      {/* Invite link box */}
      <div className="mb-8 max-w-2xl bg-card border border-border rounded-xl p-5" style={{ borderLeft: "3px solid var(--accent)" }}>
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Link zaproszeniowy — Edycja #1</span>
        </div>
        <p className="text-xs text-foreground/40 mb-3">Wyślij ten link uczestnikom, którzy kupili warsztat. Po kliknięciu mogą się zarejestrować na platformie.</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={INVITE_LINK}
            readOnly
            className="flex-1 bg-slate-light border border-border rounded-lg px-3 py-2 text-xs text-foreground/60 font-mono select-all"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={copyLink}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 flex-shrink-0 rounded-lg"
            style={{
              background: copied ? "rgba(34, 197, 94, 0.1)" : "var(--accent-light)",
              color: copied ? "#22c55e" : "var(--accent)",
            }}
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Skopiowano
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                </svg>
                Kopiuj
              </>
            )}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-8 max-w-md relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder="Szukaj członków..."
          className="w-full bg-card border border-border rounded-xl pl-11 pr-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30 transition-all placeholder:text-foreground/25"
        />
      </div>

      {/* Members grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger-children">
        {user && (
          <div className="member-card cursor-pointer group">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold bg-accent/15 text-accent">
                {user.name.charAt(0).toUpperCase()}
              </div>
              {/* Online dot */}
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-semibold text-sm text-foreground group-hover:text-accent transition-colors truncate">
                  {user.name}
                </p>
              </div>
              <p className="text-[11px] text-foreground/30 truncate">{user.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-accent/10 text-accent">
                  Admin
                </span>
                <span className="flex items-center gap-1 text-[10px] text-foreground/30">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  Online
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-accent/10 text-accent">
                  Lv. 7
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Placeholder cards */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="member-card opacity-30 cursor-default">
            <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-full bg-slate-light">
              <svg className="w-6 h-6 text-foreground/15" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="h-3 w-24 bg-slate-light rounded mb-2" />
              <div className="h-2 w-16 bg-slate-light rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Invite hint */}
      <div className="mt-10 text-center py-8 border-t border-border/50">
        <p className="text-sm text-foreground/25">Zaproś uczestników aby powiększyć społeczność</p>
      </div>
    </div>
  );
}
