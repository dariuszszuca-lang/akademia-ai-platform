const formatItems = [
  { day: "Środa", label: "Online przygotowanie", time: "9:00" },
  { day: "Czwartek", label: "Warsztat stacjonarny", time: "9:00–15:00" },
  { day: "Piątek", label: "Automatyzacje i wdrożenia", time: "9:00–15:00" },
  { day: "Sobota", label: "Q&A i replaye", time: "9:00" },
];

export default function AboutPage() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <section className="premium-grid">
        <div className="section-shell rounded-[2rem] p-8 sm:p-10">
          <div className="relative z-10 max-w-2xl">
            <p className="eyebrow">O Akademii</p>
            <h1 className="display-title mt-4 text-5xl text-foreground sm:text-6xl">
              Przestrzeń, w której wiedza przechodzi w działanie.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-foreground/66 sm:text-lg">
              Akademia AI łączy warsztaty, materiały, społeczność i pracę z agentem w jednym środowisku.
              Celem nie jest samo poznanie narzędzi, ale uruchomienie nowych sposobów pracy.
            </p>
          </div>
        </div>

        <aside className="section-shell rounded-[2rem] p-6 sm:p-7">
          <div className="relative z-10 space-y-4">
            <div>
              <p className="eyebrow">Edycja 01</p>
              <h2 className="mt-3 font-display text-3xl text-foreground">4 dni pracy.</h2>
            </div>
            <div className="rounded-[1.5rem] border border-border bg-background/55 p-5">
              <p className="text-3xl font-semibold text-foreground">1 499 PLN</p>
              <p className="mt-2 text-sm text-foreground/58">
                Cena standardowa. Dla NSL: 1 399 PLN z kodem <span className="font-semibold text-[color:var(--accent)]">AI2026</span>.
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section className="section-shell rounded-[2rem] p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-6">
            <p className="eyebrow">Format</p>
            <h2 className="mt-3 font-display text-3xl text-foreground">Jak wygląda rytm programu.</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {formatItems.map((item) => (
              <div key={item.day} className="rounded-[1.6rem] border border-border bg-background/55 p-5">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--muted-gold)]">{item.day}</p>
                <h3 className="mt-3 text-lg font-semibold text-foreground">{item.label}</h3>
                <p className="mt-2 text-sm text-foreground/58">{item.time}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="section-shell rounded-[2rem] p-6 sm:p-8">
          <div className="relative z-10">
            <p className="eyebrow">O programie</p>
            <h2 className="mt-3 font-display text-3xl text-foreground">Intensywny model wdrożeniowy.</h2>
            <p className="mt-4 text-sm leading-7 text-foreground/62">
              Akademia AI to program dla osób, które chcą realnie używać AI w codziennej pracy:
              do tworzenia ofert, komunikacji, planowania działań, pracy z klientem i budowy własnych workflowów.
              Każdy blok ma prowadzić do konkretnego efektu, nie tylko do obejrzenia materiału.
            </p>
          </div>
        </div>

        <div className="section-shell rounded-[2rem] p-6 sm:p-8">
          <div className="relative z-10">
            <p className="eyebrow">Prowadzący</p>
            <h2 className="mt-3 font-display text-3xl text-foreground">Dariusz Szuca.</h2>
            <p className="mt-4 text-sm leading-7 text-foreground/62">
              Twórca Akademii AI i praktyk wdrożeń marketingowych. Program jest zbudowany wokół pracy hands-on,
              gdzie każde spotkanie i materiał mają wspierać realne użycie AI po stronie uczestnika.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="https://akademia-ai-nieruchomosci.pl"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border bg-background/60 px-5 py-3 text-sm text-foreground"
              >
                akademia-ai-nieruchomosci.pl
              </a>
              <a
                href="https://ai-team.pl"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border bg-background/60 px-5 py-3 text-sm text-foreground"
              >
                ai-team.pl
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
