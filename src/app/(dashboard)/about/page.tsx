const format = [
  { day: "Środa 22.04", label: "Spotkanie online — wprowadzenie", time: "9:00, 1–2h", type: "online" },
  { day: "Czwartek 23.04", label: "Dzień 1 stacjonarny", time: "9:00–15:00", type: "stacjonarny" },
  { day: "Piątek 24.04", label: "Dzień 2 stacjonarny (zaawansowany)", time: "9:00–15:00", type: "stacjonarny" },
  { day: "Sobota 25.04", label: "Q&A online", time: "9:00, 1h", type: "online" },
];

const inCene = [
  "10+ skonfigurowanych agentów AI",
  "Rok dostępu do platformy z aktualizacjami",
  "Certyfikat KW-NSL-AI-2026",
  "Zamknięta grupa absolwentów",
];

const program = [
  { day: "Dzień 1", items: ["GHOST — styl pisania", "Tworzenie contentu (posty, maile, rolki)", "Konfiguracja AI Team", "Narzędzia agenta"] },
  { day: "Dzień 2", items: ["Instalacja lokalna i terminal", "API i integracje", "Automatyzacje i workflow", "Certyfikacja"] },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 animate-fade-in-up">
      <header>
        <p className="eyebrow">O Akademii</p>
        <h1 className="display-title mt-3 text-4xl text-foreground sm:text-5xl">
          Przestrzeń, w której wiedza przechodzi w działanie.
        </h1>
        <p className="mt-5 text-sm leading-7 text-foreground/65">
          Akademia AI łączy warsztaty, materiały, społeczność i pracę z agentem w jednym środowisku. Nie uczymy się samego narzędzia — uczymy się jak pracować inaczej, używając AI. ~12 godzin na żywo, wymagany własny laptop.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
          Cennik — Edycja 1 (22–25 kwietnia 2026)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background/55 p-5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-foreground/45">
              Część I
            </p>
            <p className="mt-2 font-display text-2xl text-foreground">750 zł</p>
            <p className="mt-2 text-xs text-foreground/55">Wprowadzenie + Dzień 1 stacjonarny</p>
          </div>
          <div className="rounded-2xl border-2 border-accent bg-[color:var(--card)] p-5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-accent">
              Pakiet pełny (I + II)
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="font-display text-2xl text-foreground">1 399 zł</p>
              <p className="text-sm text-foreground/45 line-through">1 500 zł</p>
            </div>
            <p className="mt-2 text-xs text-foreground/55">Wszystkie 4 dni + certyfikat + rok dostępu</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
          Format
        </h2>
        <div className="space-y-2">
          {format.map((item) => (
            <div
              key={item.day}
              className="flex items-start gap-4 rounded-xl border border-border bg-background/55 px-5 py-3"
            >
              <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/45">
                {item.day}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-foreground/50">{item.time}</p>
              </div>
              <span
                className={`shrink-0 rounded-full border border-border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] ${
                  item.type === "online"
                    ? "text-[color:var(--accent)]"
                    : "text-[color:var(--muted-gold)]"
                }`}
              >
                {item.type}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-foreground/50">
          Lokalizacja: Trójmiasto. Dokładny adres otrzymujesz mailem po zapisie.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
          Co jest w pakiecie pełnym
        </h2>
        <ul className="space-y-1 text-sm leading-7 text-foreground/70">
          {inCene.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
          Program w zarysie
        </h2>
        <div className="space-y-4">
          {program.map((day) => (
            <div key={day.day} className="rounded-2xl border border-border bg-background/55 p-5">
              <p className="text-sm font-semibold text-foreground">{day.day}</p>
              <ul className="mt-2 space-y-1 text-sm text-foreground/60">
                {day.items.map((i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
          Dla kogo
        </h2>
        <p className="text-sm leading-7 text-foreground/65">
          Agenci, pośrednicy, zarządcy, deweloperzy, rzeczoznawcy, home stagerzy — każdy z branży nieruchomości. Zaczynamy od zera — nie musisz wcześniej pracować z AI.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
          Prowadzący
        </h2>
        <p className="text-sm leading-7 text-foreground/65">
          <span className="font-semibold text-foreground">Dariusz Szuca</span> — 8 lat w marketingu, 15+ branż, 20+ narzędzi AI w praktyce. Twórca Akademii AI i praktyk wdrożeń marketingowych. Program zbudowany wokół pracy hands-on.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href="https://akademia-ai-nieruchomosci.pl"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-border bg-background/55 px-4 py-2 text-sm text-foreground/80 transition hover:border-foreground/40"
          >
            akademia-ai-nieruchomosci.pl ↗
          </a>
          <a
            href="https://ai-team.pl"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-border bg-background/55 px-4 py-2 text-sm text-foreground/80 transition hover:border-foreground/40"
          >
            ai-team.pl ↗
          </a>
        </div>
      </section>
    </div>
  );
}
