"use client";

import { useAuth } from "@/lib/auth-context";

export default function MembersPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl">
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Szukaj członków..."
          className="w-full bg-card rounded-xl border border-border px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 shadow-sm"
        />
      </div>

      {/* Members list */}
      <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
        {user && (
          <div className="flex items-center gap-4 p-4 hover:bg-slate-light/50 transition-colors cursor-pointer">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center text-gold font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-gold rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                7
              </span>
              <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-foreground">{user.name}</p>
                <span className="px-2 py-0.5 bg-gold/10 text-gold-dark text-[10px] font-semibold rounded-full uppercase">Admin</span>
              </div>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
            <span className="text-xs text-gray-400">Online</span>
          </div>
        )}
      </div>
    </div>
  );
}
