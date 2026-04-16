"use client";

import { startTransition, useState } from "react";

const actions = [
  {
    id: "oferta",
    title: "Napisz ofertę nieruchomości",
    description: "Zdjęcia, brief i ton marki zamienione w gotowy opis, headline i wersje pod różne portale.",
    result: "Opis + nagłówek + CTA",
    placeholders: {
      context: "Np. mieszkanie 3-pokojowe w Gdyni, osiedle zamknięte, balkon, klient chce sprzedać szybko, ale premium.",
      goal: "Np. przygotować opis oferty na Otodom i skróconą wersję na OLX.",
    },
  },
  {
    id: "post-mail",
    title: "Przygotuj post i mail do bazy",
    description: "Jedno zadanie uruchamia komplet komunikacji: social, newsletter i follow-up po kontakcie.",
    result: "Post + mail + follow-up",
    placeholders: {
      context: "Np. nowa oferta lub temat ekspercki, do którego chcesz przygotować komunikację.",
      goal: "Np. potrzebuję posta FB, maila do bazy i krótkiego follow-upu do leadów.",
    },
  },
  {
    id: "spotkanie",
    title: "Przygotuj się do spotkania",
    description: "Agent porządkuje kontekst, obiekcje klienta, argumenty i plan rozmowy przed spotkaniem.",
    result: "Brief spotkania",
    placeholders: {
      context: "Np. rozmowa z właścicielem, który rozważa sprzedaż i obawia się długiego czasu na rynku.",
      goal: "Np. chcę listę obiekcji, argumentów i strukturę spotkania.",
    },
  },
  {
    id: "plan-dnia",
    title: "Zaplanuj dzień pracy",
    description: "Priorytety na dziś, kolejność działań i podpowiedzi, co delegować do AI jako pierwsze.",
    result: "Plan dnia",
    placeholders: {
      context: "Np. 5 spotkań, 2 oferty do publikacji, 8 leadów do obrobienia i brak czasu na content.",
      goal: "Np. chcę realny plan dnia z priorytetami i wskazaniem, co wrzucić do AI.",
    },
  },
  {
    id: "audyt",
    title: "Oceń materiał sprzedażowy",
    description: "Szybka analiza copy, struktury i siły komunikatu z rekomendacjami poprawek.",
    result: "Audyt + poprawki",
    placeholders: {
      context: "Np. landing page, opis oferty, sekwencja mailowa albo treść reklamy.",
      goal: "Np. chcę audyt i listę najważniejszych zmian pod konwersję.",
    },
  },
  {
    id: "workflow",
    title: "Stwórz workflow dla zespołu",
    description: "Rozpisanie procesu krok po kroku: inputy, prompty, outputy i sposób użycia przez zespół.",
    result: "Workflow operacyjny",
    placeholders: {
      context: "Np. proces od pozyskania oferty do publikacji, social media i follow-upu.",
      goal: "Np. chcę schemat, który mogę dać zespołowi do powtarzalnej pracy.",
    },
  },
];

const tiers = [
  { name: "Agent", price: "299 PLN", note: "3 asystentów do codziennej pracy" },
  { name: "Team", price: "499 PLN", note: "Pełny zestaw dla zespołu i więcej scenariuszy" },
];

function generateOutput(actionId: string, context: string, goal: string) {
  const safeContext = context.trim() || "Brak dodatkowego kontekstu.";
  const safeGoal = goal.trim() || "Brak doprecyzowanego celu.";

  const templates: Record<string, string> = {
    oferta: `Nagłówek:\nWyjątkowa oferta przygotowana pod właściwego klienta\n\nOpis główny:\nNa podstawie briefu: ${safeContext}\n\nProponowana narracja:\n- zacznij od najmocniejszej przewagi nieruchomości,\n- pokaż korzyść dla kupującego,\n- domknij jasnym wezwaniem do kontaktu.\n\nCTA:\nUmów prezentację i sprawdź, czy to miejsce pasuje do Twojego planu.`,
    "post-mail": `Post:\nNa bazie tematu: ${safeContext}\n\nHook:\nZobacz, jak ten temat można zamienić w praktyczną przewagę.\n\nMail do bazy:\nTemat wiadomości: Materiał, który warto zobaczyć dziś\n\nCel komunikacji:\n${safeGoal}\n\nFollow-up:\nKrótka wiadomość przypominająca z jednym jasnym CTA.`,
    spotkanie: `Brief spotkania:\nKontekst: ${safeContext}\n\nCel:\n${safeGoal}\n\nProponowana struktura:\n1. Otwarcie i zebranie oczekiwań.\n2. Nazwanie głównych obiekcji.\n3. Argumenty dopasowane do sytuacji klienta.\n4. Propozycja następnego kroku.\n\nObiekcje do przygotowania:\n- czas,\n- cena,\n- brak pewności co do decyzji.`,
    "plan-dnia": `Plan dnia:\nKontekst: ${safeContext}\n\nPriorytet główny:\n${safeGoal}\n\nKolejność działań:\n1. Zadania wymagające decyzji i kontaktu z klientem.\n2. Zadania, które można delegować do AI.\n3. Blok publikacji i follow-upów.\n4. Domknięcie dnia i zapis wniosków.\n\nDeleguj do AI:\n- pisanie treści,\n- wstępne szkice ofert,\n- przygotowanie podsumowań.`,
    audyt: `Audyt materiału:\nMateriał wejściowy: ${safeContext}\n\nCel audytu:\n${safeGoal}\n\nNa co patrzeć:\n- czy nagłówek zatrzymuje uwagę,\n- czy struktura prowadzi do działania,\n- czy CTA jest konkretne,\n- czy język odpowiada odbiorcy.\n\nRekomendacja:\nNajpierw popraw otwarcie, potem skróć środek i wyostrz wezwanie do działania.`,
    workflow: `Workflow operacyjny:\nProces wejściowy: ${safeContext}\n\nCel:\n${safeGoal}\n\nSzkic procesu:\n1. Zbierz brief i dane wejściowe.\n2. Wygeneruj pierwszy draft w AI.\n3. Oceń jakość i popraw krytyczne miejsca.\n4. Przygotuj finalny output.\n5. Zachowaj workflow jako szablon dla zespołu.\n\nOutputy:\n- checklista,\n- prompt bazowy,\n- gotowy schemat pracy.`,
  };

  return templates[actionId] ?? `Kontekst:\n${safeContext}\n\nCel:\n${safeGoal}`;
}

export default function AgentPage() {
  const [selectedActionId, setSelectedActionId] = useState(actions[0].id);
  const [context, setContext] = useState("");
  const [goal, setGoal] = useState("");
  const [generatedOutput, setGeneratedOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedAction = actions.find((action) => action.id === selectedActionId) ?? actions[0];

  const runWorkflow = () => {
    setIsGenerating(true);

    startTransition(() => {
      const nextOutput = generateOutput(selectedAction.id, context, goal);
      setGeneratedOutput(nextOutput);
      setIsGenerating(false);
    });
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <section className="premium-grid">
        <div className="section-shell rounded-[2rem] p-8 sm:p-10">
          <div className="relative z-10 max-w-2xl">
            <p className="eyebrow">Agent</p>
            <h1 className="display-title mt-4 text-5xl text-foreground sm:text-6xl">
              Wynajmij pracę, nie tylko wiedzę.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-foreground/66 sm:text-lg">
              Zamiast pustego czatu dostajesz gotowe wejścia do realnych zadań.
              Wybierasz rezultat, dodajesz brief i uruchamiasz pracę.
            </p>
          </div>
        </div>

        <aside className="section-shell rounded-[2rem] p-6 sm:p-7">
          <div className="relative z-10 space-y-4">
            <div>
              <p className="eyebrow">Jak to działa</p>
              <h2 className="mt-3 font-display text-3xl text-foreground">Trzy ruchy do wyniku.</h2>
            </div>

            {[
              "Wybierz akcję, która odpowiada realnemu zadaniu.",
              "Dodaj kontekst, cel i ograniczenia.",
              "Odbierz gotowy materiał i dopracuj tylko szczegóły.",
            ].map((step, index) => (
              <div key={step} className="rounded-[1.4rem] border border-border bg-background/55 p-4">
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--muted-gold)]">Krok {index + 1}</p>
                <p className="mt-2 text-sm leading-6 text-foreground/62">{step}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="section-shell rounded-[2rem] p-6 sm:p-8">
          <div className="relative z-10">
            <p className="eyebrow">Gotowe akcje</p>
            <h2 className="mt-3 font-display text-3xl text-foreground">Wybierz wejście do pracy.</h2>

            <div className="mt-6 space-y-3">
              {actions.map((action) => {
                const active = action.id === selectedActionId;

                return (
                  <button
                    key={action.id}
                    onClick={() => {
                      setSelectedActionId(action.id);
                      setGeneratedOutput("");
                    }}
                    className={`w-full rounded-[1.5rem] border p-5 text-left transition-colors ${
                      active ? "border-foreground bg-foreground text-background" : "border-border bg-background/55 text-foreground"
                    }`}
                  >
                    <p className={`text-[0.68rem] uppercase tracking-[0.18em] ${active ? "text-background/70" : "text-[color:var(--muted-gold)]"}`}>
                      Wynik
                    </p>
                    <h3 className="mt-2 text-lg font-semibold">{action.title}</h3>
                    <p className={`mt-2 text-sm leading-6 ${active ? "text-background/72" : "text-foreground/58"}`}>
                      {action.description}
                    </p>
                    <div className={`mt-4 inline-flex rounded-full px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] ${active ? "bg-background/12 text-background" : "border border-border bg-background/60 text-foreground/52"}`}>
                      {action.result}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="section-shell rounded-[2rem] p-6 sm:p-8">
          <div className="relative z-10">
            <p className="eyebrow">Brief wejściowy</p>
            <h2 className="mt-3 font-display text-4xl text-foreground">{selectedAction.title}</h2>
            <p className="mt-4 text-sm leading-7 text-foreground/62">{selectedAction.description}</p>

            <div className="mt-6 grid gap-4">
              <div className="rounded-[1.5rem] border border-border bg-background/55 p-5">
                <label className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--muted-gold)]">
                  Kontekst
                </label>
                <textarea
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  placeholder={selectedAction.placeholders.context}
                  className="mt-3 min-h-[140px] w-full resize-none bg-transparent text-sm leading-7 text-foreground/72 outline-none placeholder:text-foreground/28"
                />
              </div>

              <div className="rounded-[1.5rem] border border-border bg-background/55 p-5">
                <label className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--muted-gold)]">
                  Cel
                </label>
                <textarea
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder={selectedAction.placeholders.goal}
                  className="mt-3 min-h-[120px] w-full resize-none bg-transparent text-sm leading-7 text-foreground/72 outline-none placeholder:text-foreground/28"
                />
              </div>

              <div className="rounded-[1.5rem] border border-border bg-[linear-gradient(180deg,rgba(30,78,83,0.08),rgba(255,252,247,0.48))] p-5">
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--muted-gold)]">Podgląd działania</p>
                <p className="mt-3 text-sm leading-7 text-foreground/62">
                  Po uruchomieniu agent zbierze ten brief, ułoży strukturę zadania i wygeneruje pierwszy gotowy output pod wynik:
                  <span className="font-semibold text-foreground"> {selectedAction.result}</span>.
                </p>
                <button
                  onClick={runWorkflow}
                  className="mt-5 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background"
                >
                  {isGenerating ? "Generowanie..." : "Uruchom workflow"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell rounded-[2rem] p-6 sm:p-8">
        <div className="relative z-10">
          <p className="eyebrow">Pierwszy output</p>
          <h2 className="mt-3 font-display text-3xl text-foreground">Wynik działania agenta.</h2>

          <div className="mt-6 rounded-[1.75rem] border border-border bg-background/55 p-6">
            {generatedOutput ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-foreground/68">
                {generatedOutput}
              </pre>
            ) : (
              <p className="text-sm leading-7 text-foreground/45">
                Wybierz akcję, dodaj brief i uruchom workflow. Tutaj pojawi się pierwszy szkic wyniku.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="section-shell rounded-[2rem] p-6 sm:p-8">
          <div className="relative z-10">
            <p className="eyebrow">Tryby współpracy</p>
            <h2 className="mt-3 font-display text-3xl text-foreground">Od pojedynczych zadań do pełnego systemu pracy.</h2>

            <div className="mt-6 space-y-4">
              {tiers.map((tier) => (
                <div key={tier.name} className="rounded-[1.6rem] border border-border bg-background/55 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-foreground">{tier.name}</p>
                      <p className="mt-1 text-sm text-foreground/58">{tier.note}</p>
                    </div>
                    <p className="text-xl font-semibold text-foreground">{tier.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="section-shell rounded-[2rem] p-6 sm:p-8">
          <div className="relative z-10">
            <p className="eyebrow">Po co to jest</p>
            <h2 className="mt-3 font-display text-3xl text-foreground">Agent skraca drogę od intencji do gotowego outputu.</h2>
            <p className="mt-4 text-sm leading-7 text-foreground/62">
              Dzięki temu platforma nie kończy się na materiałach i live'ach. Zamienia się w miejsce,
              gdzie po nauce od razu uruchamiasz realną produkcję treści, planów i workflowów.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
