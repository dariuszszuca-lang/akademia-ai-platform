"use client";

import { useState } from "react";

type Action = {
  id: string;
  title: string;
  description: string;
  result: string;
  placeholders: { context: string; goal: string };
};

const actions: Action[] = [
  {
    id: "oferta",
    title: "Napisz ofertę nieruchomości",
    description: "Opis, headline i wersje pod portale.",
    result: "Opis + nagłówek + CTA",
    placeholders: {
      context: "Np. mieszkanie 3-pokojowe w Gdyni, osiedle zamknięte, klient chce sprzedać szybko ale premium.",
      goal: "Np. opis na Otodom i skrócona wersja na OLX.",
    },
  },
  {
    id: "post-mail",
    title: "Przygotuj post i mail do bazy",
    description: "Social, newsletter i follow-up w jednym.",
    result: "Post + mail + follow-up",
    placeholders: {
      context: "Np. nowa oferta lub temat ekspercki.",
      goal: "Np. post FB, mail do bazy, krótki follow-up do leadów.",
    },
  },
  {
    id: "spotkanie",
    title: "Przygotuj się do spotkania",
    description: "Obiekcje klienta, argumenty, plan rozmowy.",
    result: "Brief spotkania",
    placeholders: {
      context: "Np. rozmowa z właścicielem rozważającym sprzedaż, obawy o czas na rynku.",
      goal: "Np. lista obiekcji, argumentów i struktura spotkania.",
    },
  },
  {
    id: "plan-dnia",
    title: "Zaplanuj dzień pracy",
    description: "Priorytety, kolejność działań, co delegować do AI.",
    result: "Plan dnia",
    placeholders: {
      context: "Np. 5 spotkań, 2 oferty, 8 leadów, brak czasu na content.",
      goal: "Np. plan dnia z priorytetami i wskazaniem co do AI.",
    },
  },
  {
    id: "audyt",
    title: "Oceń materiał sprzedażowy",
    description: "Analiza copy, struktury i siły komunikatu.",
    result: "Audyt + poprawki",
    placeholders: {
      context: "Np. landing page, opis oferty, sekwencja mailowa.",
      goal: "Np. audyt i lista najważniejszych zmian pod konwersję.",
    },
  },
  {
    id: "workflow",
    title: "Stwórz workflow dla zespołu",
    description: "Proces krok po kroku — inputy, prompty, outputy.",
    result: "Workflow operacyjny",
    placeholders: {
      context: "Np. proces od pozyskania oferty do publikacji + follow-up.",
      goal: "Np. schemat do powtarzalnej pracy zespołu.",
    },
  },
];

function generateOutput(actionId: string, context: string, goal: string) {
  const safeContext = context.trim() || "Brak kontekstu.";
  const safeGoal = goal.trim() || "Brak celu.";

  const templates: Record<string, string> = {
    oferta: `Nagłówek:\nWyjątkowa oferta przygotowana pod właściwego klienta\n\nOpis:\nNa podstawie: ${safeContext}\n\nNarracja:\n- zacznij od najmocniejszej przewagi,\n- pokaż korzyść kupującego,\n- domknij jasnym CTA.\n\nCTA:\nUmów prezentację i sprawdź czy to miejsce pasuje do Twojego planu.`,
    "post-mail": `Post:\nNa bazie: ${safeContext}\n\nHook:\nZobacz jak ten temat można zamienić w praktyczną przewagę.\n\nMail:\nTemat: Materiał, który warto zobaczyć dziś\n\nCel: ${safeGoal}\n\nFollow-up:\nKrótka wiadomość z jednym jasnym CTA.`,
    spotkanie: `Brief spotkania:\nKontekst: ${safeContext}\n\nCel: ${safeGoal}\n\nStruktura:\n1. Otwarcie i oczekiwania.\n2. Główne obiekcje.\n3. Argumenty pod klienta.\n4. Propozycja następnego kroku.\n\nObiekcje:\n- czas,\n- cena,\n- brak pewności decyzji.`,
    "plan-dnia": `Plan dnia:\nKontekst: ${safeContext}\n\nPriorytet: ${safeGoal}\n\nKolejność:\n1. Zadania wymagające decyzji i kontaktu.\n2. Zadania do delegacji do AI.\n3. Blok publikacji i follow-upów.\n4. Domknięcie dnia.\n\nDo AI:\n- treści,\n- szkice ofert,\n- podsumowania.`,
    audyt: `Audyt:\nMateriał: ${safeContext}\n\nCel: ${safeGoal}\n\nNa co patrzeć:\n- czy nagłówek zatrzymuje uwagę,\n- czy struktura prowadzi do działania,\n- czy CTA jest konkretne,\n- czy język pasuje do odbiorcy.\n\nRekomendacja:\nPopraw otwarcie, skróć środek, wyostrz wezwanie do działania.`,
    workflow: `Workflow:\nProces: ${safeContext}\n\nCel: ${safeGoal}\n\nSchemat:\n1. Zbierz brief i inputy.\n2. Wygeneruj draft w AI.\n3. Oceń jakość i popraw krytyczne miejsca.\n4. Finalny output.\n5. Zachowaj jako szablon.\n\nOutputy:\n- checklista,\n- prompt bazowy,\n- gotowy schemat pracy.`,
  };

  return templates[actionId] ?? `Kontekst:\n${safeContext}\n\nCel:\n${safeGoal}`;
}

export default function AgentPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [goal, setGoal] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const selected = actions.find((a) => a.id === selectedId);

  function selectAction(id: string) {
    setSelectedId(id);
    setContext("");
    setGoal("");
    setOutput(null);
  }

  function run() {
    if (!selected) return;
    setRunning(true);
    setTimeout(() => {
      setOutput(generateOutput(selected.id, context, goal));
      setRunning(false);
    }, 400);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 animate-fade-in-up">
      <header>
        <p className="eyebrow">Agent</p>
        <h1 className="display-title mt-3 text-4xl text-foreground sm:text-5xl">
          Co chcesz, żeby agent zrobił?
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-foreground/60">
          Wybierz jedno zadanie. Dodaj kontekst i cel. Odbierz gotowy materiał.
        </p>
      </header>

      {!selected ? (
        <section>
          <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
            Gotowe akcje
          </h2>
          <div className="space-y-2">
            {actions.map((a) => (
              <button
                key={a.id}
                onClick={() => selectAction(a.id)}
                className="group w-full rounded-2xl border border-border bg-background/55 p-5 text-left transition hover:border-foreground/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-foreground/55">{a.description}</p>
                    <p className="mt-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-gold)]">
                      {a.result}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-foreground/40 transition group-hover:text-foreground">
                    →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-[color:var(--card)] p-5">
            <button
              onClick={() => selectAction("")}
              className="shrink-0 text-xs text-foreground/45 hover:text-foreground"
            >
              ← Zmień
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-foreground/45">
                Wybrana akcja
              </p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">{selected.title}</h2>
              <p className="mt-1 text-xs text-foreground/55">Wynik: {selected.result}</p>
            </div>
          </div>

          <section className="space-y-4">
            <div>
              <label className="mb-2 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-foreground/50">
                Kontekst
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder={selected.placeholders.context}
                rows={3}
                className="w-full rounded-2xl border border-border bg-background/55 px-4 py-3 text-sm text-foreground placeholder:text-foreground/30 focus:border-foreground/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-foreground/50">
                Cel
              </label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={selected.placeholders.goal}
                rows={2}
                className="w-full rounded-2xl border border-border bg-background/55 px-4 py-3 text-sm text-foreground placeholder:text-foreground/30 focus:border-foreground/40 focus:outline-none"
              />
            </div>

            <button
              onClick={run}
              disabled={running}
              className="w-full rounded-2xl bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
            >
              {running ? "Pracuję..." : "Uruchom agenta"}
            </button>
          </section>

          {output && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
                  Wynik
                </h2>
                <button
                  onClick={() => navigator.clipboard.writeText(output)}
                  className="text-xs text-foreground/60 hover:text-foreground"
                >
                  Kopiuj
                </button>
              </div>
              <pre className="whitespace-pre-wrap rounded-2xl border border-border bg-[color:var(--card)] p-5 text-sm leading-6 text-foreground">
                {output}
              </pre>
            </section>
          )}
        </>
      )}
    </div>
  );
}
