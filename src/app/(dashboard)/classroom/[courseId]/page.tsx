"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

type Lesson = {
  id: string;
  title: string;
  type: "process" | "recording" | "task";
  completed: boolean;
  content?: string;
};

type Module = {
  id: number;
  title: string;
  description: string;
  lessons: Lesson[];
};

type Course = {
  title: string;
  intro: string;
  outcome: string;
  modules: Module[];
};

const courseData: Record<string, Course> = {
  start: {
    title: "Start tutaj",
    intro: "Pierwszy kontakt z platformą, orientacja i ustawienie sposobu pracy wewnątrz Akademii.",
    outcome: "Rozumiesz strukturę platformy i wiesz, od czego zacząć.",
    modules: [
      {
        id: 1,
        title: "Wejście",
        description: "Powitanie, orientacja i pierwszy krok wewnątrz Akademii AI.",
        lessons: [
          { id: "s-1", title: "Witaj w Akademii AI", type: "process", completed: false, content: "Witaj w Akademii AI.\n\nTutaj znajdziesz programy, spotkania na żywo, społeczność i agenta. Całość jest pomyślana jako środowisko pracy, a nie tylko biblioteka kursów." },
          { id: "s-2", title: "Jak poruszać się po platformie", type: "process", completed: false, content: "Zacznij od Startu.\n\nPotem przejdź do Programów, sprawdź Na żywo, zajrzyj do Społeczności i zobacz sekcję Agent, gdy chcesz przejść od wiedzy do gotowego materiału." },
          { id: "s-3", title: "Zadanie: przedstaw się", type: "task", completed: false, content: "Wejdź do Społeczności i napisz krótki wpis:\n- kim jesteś,\n- czym się zajmujesz,\n- jaki rezultat chcesz osiągnąć dzięki AI." },
        ],
      },
    ],
  },
  przygotowanie: {
    title: "Przygotowanie przed warsztatem",
    intro: "Zbierasz fundamenty, które pozwolą od razu wejść w praktykę podczas warsztatów.",
    outcome: "Masz gotowy kontekst biznesowy, persony i podstawową konfigurację narzędzi.",
    modules: [
      {
        id: 1,
        title: "Profil i oferta",
        description: "Ustawienie kontekstu biznesowego przed wejściem w warsztat.",
        lessons: [
          { id: "p-1", title: "Profil przedsiębiorcy", type: "task", completed: false, content: "Opisz swój model pracy, rynek, ofertę i przewagę. To będzie fundament dla promptów i workflowów." },
          { id: "p-2", title: "Persona kupującego", type: "task", completed: false, content: "Zapisz najważniejsze cechy klienta kupującego: potrzeby, obiekcje, język i motywacje." },
          { id: "p-3", title: "Persona sprzedającego", type: "task", completed: false, content: "Przygotuj portret klienta sprzedającego z uwzględnieniem lęków, oczekiwań i procesu decyzyjnego." },
          { id: "p-4", title: "Twoja propozycja wartości", type: "task", completed: false, content: "Zapisz ofertę w prostej formie: dla kogo, jaki efekt, dlaczego właśnie Ty." },
        ],
      },
      {
        id: 2,
        title: "Konfiguracja wejściowa",
        description: "Przygotowanie narzędzi i asystentów, z których będziesz korzystać na warsztacie.",
        lessons: [
          { id: "p-5", title: "Konfiguracja kont AI", type: "process", completed: false, content: "Upewnij się, że masz dostęp do Claude i Gemini oraz że możesz swobodnie pracować na swoim koncie." },
          { id: "p-6", title: "Pobranie asystentów", type: "process", completed: false, content: "Pobierz gotowych asystentów i przygotuj sobie środowisko do pracy w dniu warsztatowym." },
        ],
      },
    ],
  },
  "dzien-1": {
    title: "Dzień 1: Twój AI Team w akcji",
    intro: "Pierwszy dzień intensywnej pracy na realnych zadaniach i pierwszych outputach.",
    outcome: "Budujesz własny zestaw użyć AI do treści, ofert i codziennej pracy agenta.",
    modules: [
      {
        id: 1,
        title: "Rdzeń dnia pierwszego",
        description: "Przejście przez konfigurację, styl pisania, content i plan działania.",
        lessons: [
          { id: "d1-1", title: "Weryfikacja i konfiguracja", type: "process", completed: false, content: "Sprawdzenie środowiska pracy, narzędzi i gotowości do wejścia w warsztat." },
          { id: "d1-2", title: "GHOST: styl pisania", type: "process", completed: false, content: "Praca nad cyfrowym bliźniakiem stylu i tonem komunikacji." },
          { id: "d1-3", title: "Wideo, rolki, posty", type: "process", completed: false, content: "Budowa krótkich form contentowych bez opierania wszystkiego na kamerze." },
          { id: "d1-4", title: "Mój AI Team", type: "process", completed: false, content: "Kompozycja własnego zestawu asystentów pod codzienne zadania." },
          { id: "d1-5", title: "Narzędzia agenta", type: "process", completed: false, content: "Wycena, opisy, prospecting i przygotowanie materiałów do pracy z klientem." },
          { id: "d1-6", title: "Plan działania", type: "task", completed: false, content: "Zbierz wnioski i zapisz konkretne decyzje wdrożeniowe na kolejne dni." },
          { id: "d1-7", title: "Nagranie dnia 1", type: "recording", completed: false, content: "Replay warsztatu będzie dostępny po publikacji materiałów." },
        ],
      },
    ],
  },
  "dzien-2": {
    title: "Dzień 2: Automatyzacja i workflowy",
    intro: "Drugi dzień przesuwa pracę z poziomu użycia narzędzi do poziomu systemów i automatyzacji.",
    outcome: "Masz pierwsze workflowy, rozumiesz integracje i wiesz, jak rozwijać własny stack pracy.",
    modules: [
      {
        id: 1,
        title: "Zaawansowane wejście",
        description: "Od lokalnej instalacji i obsługi terminala do API, MCP i automatyzacji.",
        lessons: [
          { id: "d2-1", title: "Instalacja lokalna", type: "process", completed: false, content: "Przygotowanie lokalnego środowiska AI na komputerze." },
          { id: "d2-2", title: "Obsługa asystentów i terminala", type: "process", completed: false, content: "Jak w praktyce zarządzać pracą z agentami i kiedy używać terminala." },
          { id: "d2-3", title: "Skille, API i MCP", type: "process", completed: false, content: "Rozszerzanie możliwości pracy z AI przez połączenia i integracje." },
          { id: "d2-4", title: "Automatyzacje codziennych zadań", type: "process", completed: false, content: "Mapowanie powtarzalnych procesów do nowych workflowów." },
          { id: "d2-5", title: "Łączenie z narzędziami", type: "process", completed: false, content: "Mail, kalendarz, CRM i inne narzędzia jako warstwa wykonawcza." },
          { id: "d2-6", title: "Test i certyfikat", type: "task", completed: false, content: "Domknięcie dnia przez podsumowanie i przejście przez materiał końcowy." },
          { id: "d2-7", title: "Nagranie dnia 2", type: "recording", completed: false, content: "Replay warsztatu będzie dostępny po publikacji materiałów." },
        ],
      },
    ],
  },
  "nagrania-qa": {
    title: "Nagrania Q&A",
    intro: "Archiwum krótszych sesji, które porządkują pytania po warsztatach i wdrożeniach.",
    outcome: "Masz dostęp do replayów i dodatkowych odpowiedzi na pojawiające się problemy.",
    modules: [
      {
        id: 1,
        title: "Sesje Q&A",
        description: "Replaye i odpowiedzi na pytania zgłaszane przez uczestników.",
        lessons: [
          { id: "q-1", title: "Q&A: spotkanie 1", type: "recording", completed: false, content: "Nagranie zostanie udostępnione po spotkaniu." },
        ],
      },
    ],
  },
  biblioteka: {
    title: "Skarbiec zasobów",
    intro: "To materiały, do których wracasz po warsztatach, gdy potrzebujesz przyspieszyć pracę.",
    outcome: "Masz pod ręką prompty, checklisty, poradniki i playbooki do wdrożeń.",
    modules: [
      {
        id: 1,
        title: "Prompty i fundamenty",
        description: "Zestaw podstawowych materiałów do codziennej pracy.",
        lessons: [
          { id: "b-1", title: "Profil Express", type: "process", completed: false, content: "Prompt do szybkiego zbudowania profilu i kontekstu biznesowego." },
          { id: "b-2", title: "Persona kupującego", type: "process", completed: false, content: "Szablon do pracy nad profilem kupującego." },
          { id: "b-3", title: "Persona sprzedającego", type: "process", completed: false, content: "Szablon do pracy nad profilem sprzedającego." },
          { id: "b-4", title: "Instrukcja projektu", type: "process", completed: false, content: "Jak ustawiać projekt, brief i zakres pracy dla AI." },
          { id: "b-5", title: "Ghost: cyfrowy bliźniak", type: "process", completed: false, content: "Framework do odwzorowania własnego stylu komunikacji." },
        ],
      },
      {
        id: 2,
        title: "Checklisty i playbooki",
        description: "Checklisty jakości i materiały wspierające wdrożenie.",
        lessons: [
          { id: "b-6", title: "Checklista strony sprzedażowej", type: "process", completed: false, content: "Zestaw punktów do oceny skuteczności strony." },
          { id: "b-7", title: "Psychologia zakupowa B2C", type: "process", completed: false, content: "Skrócony przewodnik po mechanizmach decyzyjnych klienta." },
          { id: "b-8", title: "Lead magnet i popup", type: "process", completed: false, content: "Framework do budowy prostego lejka pozyskiwania kontaktów." },
        ],
      },
      {
        id: 3,
        title: "Poradniki operacyjne",
        description: "Dłuższe materiały, które pokazują pełny proces pracy.",
        lessons: [
          { id: "b-9", title: "Budowa strony WWW", type: "process", completed: false, content: "Jak przejść od idei do struktury strony z pomocą AI." },
          { id: "b-10", title: "Rolki i wideo", type: "process", completed: false, content: "Jak planować krótkie formy wideo i opisy publikacji." },
          { id: "b-11", title: "Boty Telegram i WhatsApp", type: "process", completed: false, content: "Wstęp do wdrażania prostych botów komunikacyjnych." },
        ],
      },
    ],
  },
  narzedzia: {
    title: "Narzędzia AI",
    intro: "Przegląd środowiska, na którym opiera się codzienna praktyka i warsztaty.",
    outcome: "Wiesz, które narzędzie wykorzystać do jakiego typu zadania.",
    modules: [
      {
        id: 1,
        title: "Środowisko pracy",
        description: "Krótkie przewodniki po najważniejszych narzędziach używanych w Akademii.",
        lessons: [
          { id: "n-1", title: "Claude.ai", type: "process", completed: false, content: "Podstawy pracy w Claude i budowy dobrych wejść." },
          { id: "n-2", title: "Gemini", type: "process", completed: false, content: "Kiedy używać Gemini i do czego sprawdza się najlepiej." },
          { id: "n-3", title: "NotebookLM", type: "process", completed: false, content: "Research, praca z dokumentami i porządkowanie wiedzy." },
          { id: "n-4", title: "Lovable", type: "process", completed: false, content: "Budowa prostych stron i szybkich interfejsów." },
          { id: "n-5", title: "Claude Code", type: "process", completed: false, content: "Praktyka pracy z agentem kodowym i terminalem." },
        ],
      },
    ],
  },
};

function lessonTypeMeta(type: Lesson["type"]) {
  if (type === "recording") {
    return { label: "Nagranie", style: "text-[color:var(--rose)] bg-[rgba(185,109,93,0.12)]" };
  }

  if (type === "task") {
    return { label: "Zadanie", style: "text-[color:var(--accent)] bg-accent/10" };
  }

  return { label: "Materiał", style: "text-[color:var(--olive)] bg-[rgba(87,97,80,0.12)]" };
}

export default function CoursePage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const course = courseData[courseId];

  const [activeModuleId, setActiveModuleId] = useState<number>(course?.modules[0]?.id ?? 1);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(course?.modules[0]?.lessons[0] ?? null);

  if (!course) {
    return (
      <div className="flex justify-center py-20">
        <div className="section-shell w-full max-w-2xl rounded-[2rem] p-8 text-center">
          <p className="eyebrow">Program</p>
          <h1 className="mt-4 font-display text-4xl text-foreground">Nie znaleziono tej ścieżki.</h1>
          <Link href="/programy" className="mt-6 inline-block rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background">
            Wróć do programów
          </Link>
        </div>
      </div>
    );
  }

  const totalLessons = course.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const completedLessons = course.modules.reduce(
    (sum, module) => sum + module.lessons.filter((lesson) => lesson.completed).length,
    0
  );
  const progressPercent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const activeModule = course.modules.find((module) => module.id === activeModuleId) ?? course.modules[0];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <section className="premium-grid">
        <div className="section-shell rounded-[2rem] p-8 sm:p-10">
          <div className="relative z-10 max-w-2xl">
            <Link href="/programy" className="eyebrow inline-block hover:opacity-80">
              Wróć do programów
            </Link>
            <h1 className="display-title mt-4 text-5xl text-foreground sm:text-6xl">{course.title}</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-foreground/66 sm:text-lg">{course.intro}</p>
          </div>
        </div>

        <aside className="section-shell rounded-[2rem] p-6 sm:p-7">
          <div className="relative z-10 space-y-5">
            <div>
              <p className="eyebrow">Rezultat programu</p>
              <h2 className="mt-3 font-display text-3xl text-foreground">{course.outcome}</h2>
            </div>
            <div className="rounded-[1.5rem] border border-border bg-background/55 p-5">
              <p className="text-sm text-foreground/42">Postęp</p>
              <p className="mt-2 text-4xl font-semibold text-foreground">{progressPercent}%</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-light">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--muted-gold))]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-foreground/52">
                {completedLessons} z {totalLessons} elementów
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section className="section-shell rounded-[2rem] p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-6">
            <p className="eyebrow">Roadmapa</p>
            <h2 className="mt-3 font-display text-3xl text-foreground">Etapy tej ścieżki.</h2>
          </div>

          <div className="flex flex-wrap gap-3">
            {course.modules.map((module, index) => {
              const active = module.id === activeModuleId;

              return (
                <button
                  key={module.id}
                  onClick={() => {
                    setActiveModuleId(module.id);
                    setSelectedLesson(module.lessons[0] ?? null);
                  }}
                  className={`rounded-[1.4rem] border px-5 py-4 text-left transition-colors ${
                    active ? "border-foreground bg-foreground text-background" : "border-border bg-background/55 text-foreground"
                  }`}
                >
                  <p className={`text-[0.68rem] uppercase tracking-[0.18em] ${active ? "text-background/70" : "text-foreground/38"}`}>
                    Etap {index + 1}
                  </p>
                  <p className="mt-2 text-sm font-semibold">{module.title}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="section-shell rounded-[2rem] p-6 sm:p-8">
          <div className="relative z-10">
            <p className="eyebrow">Aktualny etap</p>
            <h2 className="mt-3 font-display text-3xl text-foreground">{activeModule.title}</h2>
            <p className="mt-3 text-sm leading-7 text-foreground/58">{activeModule.description}</p>

            <div className="mt-6 space-y-3">
              {activeModule.lessons.map((lesson, index) => {
                const meta = lessonTypeMeta(lesson.type);
                const active = selectedLesson?.id === lesson.id;

                return (
                  <button
                    key={lesson.id}
                    onClick={() => setSelectedLesson(lesson)}
                    className={`w-full rounded-[1.5rem] border p-5 text-left transition-colors ${
                      active ? "border-foreground bg-foreground text-background" : "border-border bg-background/55 text-foreground"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={`text-[0.68rem] uppercase tracking-[0.18em] ${active ? "text-background/65" : "text-foreground/35"}`}>
                          Element {index + 1}
                        </p>
                        <h3 className="mt-2 text-base font-semibold">{lesson.title}</h3>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] ${active ? "bg-background/15 text-background" : meta.style}`}>
                        {meta.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="section-shell rounded-[2rem] p-6 sm:p-8">
          <div className="relative z-10">
            {selectedLesson ? (
              <>
                <p className="eyebrow">Wybrany element</p>
                <h2 className="mt-3 font-display text-4xl text-foreground">{selectedLesson.title}</h2>

                <div className="mt-5 inline-flex rounded-full px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-foreground/72">
                  <span className={`rounded-full px-3 py-1 ${lessonTypeMeta(selectedLesson.type).style}`}>
                    {lessonTypeMeta(selectedLesson.type).label}
                  </span>
                </div>

                <div className="mt-6 rounded-[1.75rem] border border-border bg-background/55 p-6">
                  {selectedLesson.content ? (
                    <div className="whitespace-pre-line text-[15px] leading-8 text-foreground/66">
                      {selectedLesson.content}
                    </div>
                  ) : (
                    <p className="text-sm text-foreground/45">Treść zostanie dodana wkrótce.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm text-foreground/45">Wybierz element z lewej strony.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
