"use client";

import Link from "next/link";

type FeedItem = {
  id: string;
  type: "Sygnał" | "Wygrana" | "Materiał" | "Pytanie" | "Ogłoszenie";
  author: string;
  role: string;
  title: string;
  body: string;
  replies?: number;
  featured?: boolean;
};

const feed: FeedItem[] = [
  {
    id: "1",
    type: "Ogłoszenie",
    author: "Dariusz Szuca",
    role: "Prowadzący",
    title: "Spotkanie online w środę otwiera warsztaty Edycji 1",
    body: "Link do Zoom dostaniecie mailem + w module Dzień 1. Przed spotkaniem domknij moduł Przygotowanie — wtedy środa wejdzie gładko.",
    featured: true,
  },
  {
    id: "2",
    type: "Materiał",
    author: "Dariusz Szuca",
    role: "Prowadzący",
    title: "Nowy playbook w Skarbcu: prompt pack dla agentów nieruchomości",
    body: "Zebrane prompty do ofert, maili i przygotowania spotkań. Wejdź w Skarbiec jeśli chcesz już działać na realnych zadaniach.",
  },
  {
    id: "3",
    type: "Pytanie",
    author: "Dariusz Szuca",
    role: "Prowadzący",
    title: "Jakie zadanie chcesz zautomatyzować jako pierwsze po warsztacie?",
    body: "Zbierzmy konkretne przypadki użycia, żeby podczas live pracować na realnych procesach uczestników.",
    replies: 6,
  },
];

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 animate-fade-in-up">
      <header>
        <p className="eyebrow">Społeczność</p>
        <h1 className="display-title mt-3 text-4xl text-foreground sm:text-5xl">
          Co się dzieje w tej edycji.
        </h1>
      </header>

      <section className="flex flex-col items-start gap-4 rounded-[2rem] border border-border bg-[color:var(--card)] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
            Masz wygraną lub pytanie?
          </p>
          <h2 className="mt-2 font-display text-lg text-foreground">
            Napisz — odbierają wszyscy z edycji.
          </h2>
        </div>
        <div className="flex gap-2">
          <button className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90">
            Wygrana
          </button>
          <button className="rounded-full border border-border bg-background/55 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-foreground/40">
            Pytanie
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
          Ostatnie ruchy
        </h2>
        <div className="space-y-3">
          {feed.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <div className="text-center">
        <Link
          href="/classroom"
          className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/60 underline-offset-4 hover:underline"
        >
          Wróć do warsztatów →
        </Link>
      </div>
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <article
      className={`rounded-2xl border border-border p-5 ${
        item.featured ? "bg-[color:var(--card)]" : "bg-background/55"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
          {item.author.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {item.author}
          </p>
          <p className="truncate text-xs text-foreground/50">{item.role}</p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-background/70 px-3 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-foreground/55">
          {item.type}
        </span>
      </div>

      <h3 className="mt-4 text-base font-semibold leading-snug text-foreground">
        {item.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-foreground/60">{item.body}</p>

      {item.replies !== undefined && (
        <div className="mt-4 flex items-center gap-4 text-xs text-foreground/50">
          <span>💬 {item.replies} odpowiedzi</span>
          <button className="underline-offset-4 hover:underline">Dołącz do rozmowy</button>
        </div>
      )}
    </article>
  );
}
