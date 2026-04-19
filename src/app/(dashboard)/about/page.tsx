const format = [
  { day: "Środa 22.04", label: "Spotkanie online", time: "9:00", type: "online" },
  { day: "Czwartek 23.04", label: "Dzień 2 — stacjonarny (podstawy)", time: "9:00–15:00", type: "stacjonarny" },
  { day: "Piątek 24.04", label: "Dzień 3 — stacjonarny (zaawansowany)", time: "9:00–15:00", type: "stacjonarny" },
  { day: "Sobota 25.04", label: "Q&A online", time: "10:00", type: "online" },
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
          Akademia AI łączy warsztaty, materiały, społeczność i pracę z agentem w jednym środowisku. Nie uczymy się samego narzędzia — uczymy się jak pracować inaczej, używając AI.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
          Edycja 1 — 22–25 kwietnia 2026
        </h2>
        <div className="rounded-2xl border border-border bg-[color:var(--card)] p-6">
          <p className="font-display text-2xl text-foreground">1 499 PLN</p>
          <p className="mt-1 text-sm text-foreground/55">
            Cena standardowa. Dla NSL i Keller Williams:{" "}
            <span className="font-semibold text-foreground">1 399 PLN</span> z kodem{" "}
            <span className="rounded-md bg-accent/10 px-2 py-0.5 font-mono text-xs font-semibold text-accent">
              AI2026
            </span>
          </p>
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
      </section>

      <section>
        <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
          Dla kogo
        </h2>
        <p className="text-sm leading-7 text-foreground/65">
          Dla osób, które chcą realnie używać AI w codziennej pracy — przy ofertach, komunikacji z klientem, planowaniu działań, tworzeniu workflowów. Program jest zbudowany wokół pracy hands-on. Każde spotkanie i materiał prowadzi do konkretnego efektu, nie tylko do obejrzenia.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
          Prowadzący
        </h2>
        <p className="text-sm leading-7 text-foreground/65">
          <span className="font-semibold text-foreground">Dariusz Szuca</span> — twórca Akademii AI, praktyk wdrożeń marketingowych. Program zbudowany wokół pracy hands-on, żeby każdy uczestnik wychodził z warsztatów z działającymi rozwiązaniami, a nie notatkami.
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
