"use client";

import { useAuth } from "@/lib/auth-context";

export default function MembersPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-heading text-2xl font-semibold text-foreground tracking-wide">Członkowie</h2>
        <p className="text-sm text-foreground/40 mt-1">Uczestnicy Akademii AI</p>
      </div>

      {/* Search */}
      <div className="mb-6 relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/25" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder="Szukaj członków..."
          className="w-full bg-card rounded-xl border border-border pl-11 pr-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold/30 transition-all placeholder:text-foreground/25"
        />
      </div>

      {/* Members list */}
      <div className="space-y-3 stagger-children">
        {user && (
          <div className="bg-card rounded-2xl border border-border p-5 card-hover cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-13 h-13 rounded-xl bg-gradient-to-br from-gold/25 to-gold/10 flex items-center justify-center text-gold font-semibold text-lg" style={{ width: '52px', height: '52px' }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                {/* Level badge */}
                <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-gradient-to-br from-gold to-gold-dark rounded-lg text-[10px] font-bold text-white flex items-center justify-center shadow-sm">
                  7
                </span>
                {/* Online indicator */}
                <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-0.5">
                  <p className="font-semibold text-sm text-foreground group-hover:text-gold-dark transition-colors">{user.name}</p>
                  <span className="px-2 py-0.5 bg-gold/10 text-gold-dark text-[9px] font-bold rounded-md uppercase tracking-wider">Admin</span>
                </div>
                <p className="text-xs text-foreground/30">{user.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-foreground/30 font-medium">Online</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty state hint */}
      <div className="mt-8 text-center py-8">
        <div className="w-14 h-14 rounded-2xl bg-slate-light flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-foreground/15" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
        </div>
        <p className="text-sm text-foreground/25">Zaproś uczestników aby powiększyć społeczność</p>
      </div>
    </div>
  );
}
