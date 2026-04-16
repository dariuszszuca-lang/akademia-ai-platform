"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const priorities = [
  {
    label: "Najbliższe na żywo",
    title: "Spotkanie online: przygotowanie do warsztatu",
    meta: "15 kwietnia, 9:00",
    href: "/na-zywo",
  },
  {
    label: "Aktywny program",
    title: "Przygotowanie przed warsztatem",
    meta: "6 zadań do zamknięcia przed startem",
    href: "/programy/przygotowanie",
  },
  {
    label: "Polecany materiał",
    title: "START TUTAJ",
    meta: "Krótki moduł orientacyjny na wejście",
    href: "/programy/start",
  },
];

const weeklyAgenda = [
  {
    day: "Środa",
    title: "Spotkanie online i ustawienie kierunku tygodnia",
    detail: "Checklisty, przygotowanie materiałów i pytania otwierające.",
  },
  {
    day: "Czwartek",
    title: "Dzień 1: Twój AI Team w Akcji",
    detail: "Konfiguracja, styl pisania, rolki, posty i plan działań.",
  },
  {
    day: "Piątek",
    title: "Dzień 2: Automatyzacja i zaawansowane workflowy",
    detail: "Skille, API, MCP, automatyzacje i certyfikacja.",
  },
  {
    day: "Sobota",
    title: "Sesja Q&A i domknięcie wdrożeń",
    detail: "Replaye, odpowiedzi i kolejne kroki po warsztacie.",
  },
];

const unlocks = [
  { type: "Nowe nagranie", title: "Replay: Konfiguracja AI Team", tone: "var(--accent)" },
  { type: "Playbook", title: "Jak przygotować ofertę nieruchomości z AI", tone: "var(--muted-gold)" },
  { type: "Case study", title: "Od pomysłu do publikacji w 30 minut", tone: "var(--rose)" },
  { type: "Prompt pack", title: "Prompty do maili, postów i opisów ofert", tone: "var(--olive)" },
];

const conciergeActions = [
  "Napisz ofertę sprzedażową",
  "Przygotuj post i mail do bazy",
  "Zaplanuj dzień pracy agenta",
];

export default function StartPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 animate-fade-in-up">
      <section className="premium-grid">
        <div className="section-shell rounded-[2rem] p-8 sm:p-10">
          <div className="relative z-10 max-w-2xl">
            <p className="eyebrow">W środku Akademii AI</p>
            <h1 className="display-title mt-4 text-5xl text-foreground sm:text-6xl">
              Twoje centrum pracy z AI.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-foreground/68 sm:text-lg">
              Tutaj widzisz, co jest najważniejsze dziś: program, spotkania na żywo,
              nowe materiały i wejście do pracy z agentem.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/programy"
                className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background"
              >
                Kontynuuj program
              </Link>
              <Link
                href="/agent"
                className="rounded-full border border-border bg-background/60 px-6 py-3 text-sm font-semibold text-foreground"
              >
                Otwórz agenta
              </Link>
            </div>
          </div>
        </div>

        <aside className="section-shell texture-dots rounded-[2rem] p-6 sm:p-7">
          <div className="relative z-10 space-y-6">
            <div>
              <p className="eyebrow">Status tygodnia</p>
              <h2 className="mt-3 font-display text-3xl text-foreground">
                {user?.name ? `${user.name.split(" ")[0]}, jesteś w rytmie.` : "Jesteś w rytmie."}
              </h2>
            </div>

            <div className="rounded-[1.5rem] border border-border bg-background/50 p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-foreground/45">Postęp programu</p>
                  <p className="mt-2 text-4xl font-semibold text-foreground">24%</p>
                </div>
                <p className="text-sm text-foreground/45">Edycja 01</p>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-light">
                <div
                  className="h-full rounded-full"
                  style={{ width: "24%", background: "linear-gradient(90deg, var(--accent), var(--muted-gold))" }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-[1.5rem] border border-border bg-background/50 p-4">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-foreground/35">
                  Najbliższe spotkanie
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">Dziś, 9:00</p>
                <p className="mt-1 text-sm text-foreground/55">Przygotowanie materiałów i kierunku pracy.</p>
              </div>
              <div className="rounded-[1.5rem] border border-border bg-background/50 p-4">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-foreground/35">
                  Sygnał dnia
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">Nowy playbook w skarbcu</p>
                <p className="mt-1 text-sm text-foreground/55">Prompt pack i szablony dla agentów nieruchomości.</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="section-shell rounded-[2rem] p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Najważniejsze teraz</p>
              <h2 className="mt-3 font-display text-3xl text-foreground">Trzy wejścia, które prowadzą do wartości.</h2>
            </div>
            <Link href="/na-zywo" className="text-sm text-foreground/55 underline-offset-4 hover:underline">
              Zobacz cały tydzień
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {priorities.map((item, index) => (
              <Link
                key={item.title}
                href={item.href}
                className={`card-hover rounded-[1.75rem] border border-border p-6 ${
                  index === 0 ? "bg-[linear-gradient(180deg,rgba(30,78,83,0.08),rgba(255,252,247,0.5))]" : "bg-background/55"
                }`}
              >
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-foreground/35">{item.label}</p>
                <h3 className="mt-4 text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-foreground/58">{item.meta}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="section-shell rounded-[2rem] p-6 sm:p-8">
          <div className="relative z-10">
            <p className="eyebrow">Ten tydzień</p>
            <h2 className="mt-3 font-display text-3xl text-foreground">Rytm pracy wewnątrz platformy.</h2>

            <div className="mt-8 space-y-4">
              {weeklyAgenda.map((item) => (
                <div key={item.day} className="rounded-[1.5rem] border border-border bg-background/55 p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-gold)]">
                      {item.day}
                    </p>
                    <div className="max-w-xl">
                      <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-foreground/56">{item.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section className="section-shell rounded-[2rem] p-6 sm:p-8">
            <div className="relative z-10">
              <p className="eyebrow">Nowe w skarbcu</p>
              <h2 className="mt-3 font-display text-3xl text-foreground">Świeżo odblokowane materiały.</h2>

              <div className="mt-6 grid gap-3">
                {unlocks.map((item) => (
                  <div key={item.title} className="rounded-[1.4rem] border border-border bg-background/55 p-4">
                    <p className="text-[0.72rem] uppercase tracking-[0.18em]" style={{ color: item.tone }}>
                      {item.type}
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">{item.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="section-shell rounded-[2rem] p-6 sm:p-8">
            <div className="relative z-10">
              <p className="eyebrow">Wynajmij agenta</p>
              <h2 className="mt-3 font-display text-3xl text-foreground">Uruchom realną pracę, nie tylko naukę.</h2>
              <p className="mt-3 text-sm leading-6 text-foreground/58">
                Zamiast pustego czatu zacznij od gotowych akcji, które od razu prowadzą do wyniku.
              </p>

              <div className="mt-5 space-y-3">
                {conciergeActions.map((action) => (
                  <button
                    key={action}
                    className="w-full rounded-[1.25rem] border border-border bg-background/60 px-4 py-4 text-left text-sm font-medium text-foreground transition-colors hover:border-foreground/20"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
