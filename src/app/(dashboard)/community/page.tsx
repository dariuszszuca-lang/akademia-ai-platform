"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

const filters = ["Przegląd", "Wygrane", "Dyskusje", "Nowe materiały", "Ogłoszenia"];

const signals = [
  {
    type: "Przegląd tygodnia",
    title: "W tym tygodniu zamykamy przygotowanie i wchodzimy w dwa dni intensywnej pracy.",
    body: "Najważniejsze są dziś: moduł przygotowawczy, spotkanie online i zebranie pytań do warsztatu. Wejdź w program, jeśli jeszcze nie domknąłeś konfiguracji.",
    featured: true,
  },
  {
    type: "Wygrana",
    title: "Pierwszy uczestnik zbudował pełny zestaw post + mail + opis oferty w 28 minut.",
    body: "To dobry sygnał, że workflow działa i warto go zamknąć jako szablon do dalszej pracy.",
  },
  {
    type: "Nowy materiał",
    title: "W skarbcu pojawił się nowy prompt pack do pracy agenta nieruchomości.",
    body: "Zebrane prompty do ofert, wiadomości, opisów i przygotowania spotkań.",
  },
  {
    type: "Ogłoszenie",
    title: "Replaye i materiały z sesji Q&A będą publikowane w soboty po spotkaniu.",
    body: "Jeśli nie możesz wejść na żywo, materiały będą gotowe do odtworzenia jeszcze tego samego dnia.",
  },
];

const conversations = [
  {
    author: "Dariusz Szuca",
    role: "Prowadzący",
    title: "Jakie zadanie chcesz zautomatyzować jako pierwsze po warsztacie?",
    excerpt: "Zbierzmy konkretne przypadki użycia, żeby podczas live pracować na realnych procesach uczestników.",
    replies: 6,
  },
  {
    author: "Członek edycji #1",
    role: "Uczestnik",
    title: "Który model najlepiej sprawdza się do przygotowania oferty i maila follow-up?",
    excerpt: "Testuję dwa podejścia i chcę porównać jakość przy krótkich promptach i bardziej rozbudowanych briefach.",
    replies: 3,
  },
  {
    author: "Członek edycji #1",
    role: "Uczestnik",
    title: "Czy ktoś ma już własny workflow do rolek i opisów na social media?",
    excerpt: "Szukam prostego procesu od tematu, przez skrypt, po finalny opis publikacji.",
    replies: 4,
  },
];

const pulse = [
  { label: "Nowe wpisy", value: "12" },
  { label: "Aktywni dziś", value: "7" },
  { label: "Najbliższy live", value: "9:00" },
];

export default function CommunityPage() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState(0);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <section className="premium-grid">
        <div className="section-shell rounded-[2rem] p-8 sm:p-10">
          <div className="relative z-10 max-w-2xl">
            <p className="eyebrow">Społeczność</p>
            <h1 className="display-title mt-4 text-5xl text-foreground sm:text-6xl">
              Co porusza platformę w tym tygodniu.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-foreground/66 sm:text-lg">
              To nie jest zwykły feed. To miejsce na ogłoszenia, wygrane, pytania i sygnały,
              które naprawdę popychają uczestników do działania.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background">
                Podziel się wygraną
              </button>
              <button className="rounded-full border border-border bg-background/60 px-6 py-3 text-sm font-semibold text-foreground">
                Zadaj pytanie
              </button>
            </div>
          </div>
        </div>

        <aside className="section-shell rounded-[2rem] p-6 sm:p-7">
          <div className="relative z-10">
            <p className="eyebrow">Puls społeczności</p>
            <h2 className="mt-3 font-display text-3xl text-foreground">
              {user?.name ? `${user.name.split(" ")[0]}, jesteś w środku obiegu.` : "Jesteś w środku obiegu."}
            </h2>

            <div className="mt-6 grid gap-3">
              {pulse.map((item) => (
                <div key={item.label} className="rounded-[1.4rem] border border-border bg-background/55 p-4">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-foreground/35">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <section className="section-shell rounded-[2rem] p-6 sm:p-8">
        <div className="relative z-10">
          <div className="flex flex-wrap gap-2">
            {filters.map((filter, index) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(index)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  activeFilter === index
                    ? "bg-foreground text-background"
                    : "border border-border bg-background/60 text-foreground/58"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <section className="section-shell rounded-[2rem] p-6 sm:p-8">
            <div className="relative z-10">
              <p className="eyebrow">Przegląd tygodnia</p>
              <div className="mt-4 rounded-[2rem] border border-border bg-[linear-gradient(135deg,rgba(30,78,83,0.12),rgba(178,138,82,0.08),rgba(255,252,247,0.5))] p-6 sm:p-8">
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--muted-gold)]">
                  Brief prowadzącego
                </p>
                <h2 className="mt-4 max-w-3xl font-display text-4xl text-foreground">
                  Zbieramy tempo przed warsztatem i zamieniamy wiedzę w realne workflowy.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-foreground/62">
                  Najpierw porządek i przygotowanie. Potem live, wdrożenia i praca z agentem.
                  Wszystko, co pojawia się w tym tygodniu, ma prowadzić do szybszego działania po warsztacie.
                </p>
              </div>
            </div>
          </section>

          <section className="section-shell rounded-[2rem] p-6 sm:p-8">
            <div className="relative z-10">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Sygnały</p>
                  <h2 className="mt-3 font-display text-3xl text-foreground">Najważniejsze ruchy wewnątrz platformy.</h2>
                </div>
                <Link href="/programy" className="text-sm text-foreground/55 underline-offset-4 hover:underline">
                  Otwórz programy
                </Link>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {signals.map((item, index) => (
                  <article
                    key={item.title}
                    className={`rounded-[1.75rem] border border-border p-5 ${
                      item.featured || index === 0
                        ? "bg-[linear-gradient(180deg,rgba(30,78,83,0.08),rgba(255,252,247,0.48))] lg:col-span-2"
                        : "bg-background/55"
                    }`}
                  >
                    <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--muted-gold)]">
                      {item.type}
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-foreground/58">{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="section-shell rounded-[2rem] p-6 sm:p-8">
            <div className="relative z-10">
              <p className="eyebrow">Rozmowy</p>
              <h2 className="mt-3 font-display text-3xl text-foreground">Pytania i praktyka uczestników.</h2>

              <div className="mt-6 space-y-3">
                {conversations.map((item) => (
                  <article key={item.title} className="rounded-[1.5rem] border border-border bg-background/55 p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                        {item.author.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.author}</p>
                        <p className="text-xs text-foreground/35">{item.role}</p>
                      </div>
                    </div>

                    <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-foreground/58">{item.excerpt}</p>
                    <p className="mt-4 text-xs uppercase tracking-[0.18em] text-foreground/35">
                      {item.replies} odpowiedzi
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="section-shell rounded-[2rem] p-6 sm:p-8">
            <div className="relative z-10">
              <p className="eyebrow">Szybkie wejścia</p>
              <h2 className="mt-3 font-display text-3xl text-foreground">Przejdź od rozmowy do działania.</h2>

              <div className="mt-5 space-y-3">
                <Link href="/na-zywo" className="block rounded-[1.4rem] border border-border bg-background/55 p-4 text-sm font-medium text-foreground">
                  Sprawdź najbliższy live
                </Link>
                <Link href="/programy" className="block rounded-[1.4rem] border border-border bg-background/55 p-4 text-sm font-medium text-foreground">
                  Otwórz program i materiały
                </Link>
                <Link href="/ludzie" className="block rounded-[1.4rem] border border-border bg-background/55 p-4 text-sm font-medium text-foreground">
                  Zobacz ludzi w środku edycji
                </Link>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
