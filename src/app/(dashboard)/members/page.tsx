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
    <div className="mx-auto max-w-4xl space-y-10 animate-fade-in-up">
      <header>
        <p className="eyebrow">Ludzie</p>
        <h1 className="display-title mt-3 text-4xl text-foreground sm:text-5xl">
          Kto jest w tej edycji.
        </h1>
      </header>

      <section>
        <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
          W Akademii teraz
        </h2>
        <div className="space-y-2">
          {user && (
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-background/55 px-5 py-4">
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-base font-bold text-accent">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[color:var(--card)] bg-green-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                <p className="truncate text-xs text-foreground/50">{user.email}</p>
              </div>
              <span className="shrink-0 rounded-full bg-accent/10 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-accent">
                Admin
              </span>
            </div>
          )}
          <p className="pt-3 text-xs text-foreground/45">
            Pozostałe osoby pojawią się kiedy dołączą do edycji.
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-[color:var(--card)] p-6">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
          Zaproszenie
        </p>
        <h3 className="mt-2 font-display text-xl text-foreground">
          Dodaj kolejną osobę do tej edycji.
        </h3>
        <p className="mt-2 text-sm text-foreground/55">
          Jeden link rejestracyjny dla uczestników bieżącej edycji.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={INVITE_LINK}
            readOnly
            className="min-w-0 flex-1 rounded-full border border-border bg-background/55 px-4 py-2.5 text-xs text-foreground/60 focus:outline-none"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={copyLink}
            className="shrink-0 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
          >
            {copied ? "Skopiowano ✓" : "Skopiuj link"}
          </button>
        </div>
      </section>
    </div>
  );
}
