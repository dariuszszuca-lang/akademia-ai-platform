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
    <div className="space-y-6 animate-fade-in-up">
      <section className="premium-grid">
        <div className="section-shell rounded-[2rem] p-8 sm:p-10">
          <div className="relative z-10 max-w-2xl">
            <p className="eyebrow">Ludzie</p>
            <h1 className="display-title mt-4 text-5xl text-foreground sm:text-6xl">
              Osoby wewnątrz tej edycji.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-foreground/66 sm:text-lg">
              To nie jest tylko lista kont. To osoby, z którymi pracujesz, wymieniasz praktykę
              i budujesz rytm wdrożeń wewnątrz Akademii.
            </p>
          </div>
        </div>

        <aside className="section-shell rounded-[2rem] p-6 sm:p-7">
          <div className="relative z-10">
            <p className="eyebrow">Zaproszenie</p>
            <h2 className="mt-3 font-display text-3xl text-foreground">
              Dodaj kolejną osobę do środka.
            </h2>
            <p className="mt-3 text-sm leading-6 text-foreground/58">
              Użyj jednego linku rejestracyjnego dla uczestników aktualnej edycji.
            </p>

            <button
              onClick={copyLink}
              className="mt-5 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background"
            >
              {copied ? "Skopiowano link" : "Skopiuj link zaproszeniowy"}
            </button>
          </div>
        </aside>
      </section>

      <section className="section-shell rounded-[2rem] p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Link rejestracyjny</p>
              <h2 className="mt-3 font-display text-3xl text-foreground">Wejście do tej edycji.</h2>
            </div>
            <div className="w-full max-w-2xl rounded-[1.4rem] border border-border bg-background/55 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={INVITE_LINK}
                  readOnly
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-xs text-foreground/62 focus:outline-none"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={copyLink}
                  className="rounded-full border border-border bg-background/65 px-4 py-2 text-sm text-foreground"
                >
                  {copied ? "Skopiowano" : "Kopiuj"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell rounded-[2rem] p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-6">
            <p className="eyebrow">Osoby aktywne</p>
            <h2 className="mt-3 font-display text-3xl text-foreground">Kto jest już w środku.</h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {user && (
              <div className="member-card">
                <div className="relative flex-shrink-0">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-xl font-bold text-accent">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute -right-0.5 top-0 h-3 w-3 rounded-full border-2 border-[color:var(--card-strong)] bg-green-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-foreground">{user.name}</p>
                  <p className="truncate text-sm text-foreground/38">{user.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-accent/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-accent">
                      Admin
                    </span>
                    <span className="rounded-full border border-border px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-foreground/45">
                      Online
                    </span>
                  </div>
                </div>
              </div>
            )}

            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="member-card opacity-45">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-light text-foreground/20">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="h-4 w-28 rounded bg-slate-light" />
                  <div className="mt-3 h-3 w-20 rounded bg-slate-light" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
