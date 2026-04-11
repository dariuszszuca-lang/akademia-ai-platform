"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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
  lessons: Lesson[];
};

const courseData: Record<string, { title: string; modules: Module[] }> = {
  "start": {
    title: "START TUTAJ",
    modules: [
      {
        id: 1,
        title: "Powitanie i Orientacja",
        lessons: [
          { id: "s-1", title: "Witaj w Akademii AI!", type: "process", completed: false, content: "Witaj w Akademii AI! To jest Twoja platforma szkoleniowa.\n\nTutaj znajdziesz:\n- Materiały z każdego warsztatu\n- Nagrania sesji\n- Zadania do wykonania\n- Społeczność uczestników\n\nZacznij od przejrzenia zakładek na górze strony." },
          { id: "s-2", title: "Jak korzystać z platformy", type: "process", completed: false, content: "Krótki poradnik jak poruszać się po platformie:\n\n1. Społeczność — posty, pytania, dyskusje\n2. Materiały — kursy, nagrania, zadania\n3. Kalendarz — harmonogram warsztatów\n4. Członkowie — lista uczestników\n5. O nas — informacje o Akademii" },
          { id: "s-3", title: "Zadanie: Przedstaw się", type: "task", completed: false, content: "Wejdź do zakładki Społeczność i napisz krótki post:\n\n- Kim jesteś?\n- Czym się zajmujesz?\n- Co chcesz osiągnąć dzięki AI?\n\nTo pomoże nam lepiej dopasować warsztaty do Twoich potrzeb." },
        ],
      },
    ],
  },
  "edycja-1": {
    title: "AKADEMIA AI — EDYCJA I",
    modules: [
      {
        id: 1,
        title: "WARSZTAT 1: Myślenie AI-First + Narzędzia",
        lessons: [
          { id: "1-1", title: "Proces: AI-First Mindset", type: "process", completed: false, content: "Wprowadzenie do myślenia AI-First. Jak zmienić podejście do pracy z AI — nie jako narzędzie, ale jako partner w biznesie.\n\nKluczowe koncepty:\n- AI jako asystent vs AI jako współpracownik\n- Kiedy AI daje 10x, a kiedy 2x\n- Przykłady z nieruchomości" },
          { id: "1-2", title: "Nagranie Warsztatu", type: "recording", completed: false, content: "Nagranie zostanie udostępnione po warsztacie." },
          { id: "1-3", title: "Zadanie 1: Profil Express", type: "task", completed: false, content: "Stwórz swój profil biznesowy w formacie AI-ready.\n\n1. Otwórz Claude lub ChatGPT\n2. Wklej prompt z materiałów (Profil Express)\n3. Odpowiedz na pytania\n4. Zapisz wynik jako PDF\n5. Wrzuć tutaj jako załącznik" },
          { id: "1-4", title: "Zadanie 2: Konfiguracja narzędzi", type: "task", completed: false, content: "Zainstaluj i skonfiguruj narzędzia:\n\n- Claude.ai (konto darmowe)\n- Google Gemini\n- Notion (opcjonalnie)\n\nSprawdź czy wszystko działa przed warsztatem." },
        ],
      },
      {
        id: 2,
        title: "WARSZTAT 2: Analiza Rynku + Analityka",
        lessons: [
          { id: "2-1", title: "Proces: Analiza Rynku z AI", type: "process", completed: false, content: "Jak używać AI do analizy rynku nieruchomości w Twojej lokalizacji." },
          { id: "2-2", title: "Nagranie Warsztatu", type: "recording", completed: false },
          { id: "2-3", title: "Zadanie 1: Analiza konkurencji", type: "task", completed: false },
        ],
      },
      {
        id: 3,
        title: "WARSZTAT 3: Oferta + Wycena",
        lessons: [
          { id: "3-1", title: "Proces: Tworzenie ofert z AI", type: "process", completed: false },
          { id: "3-2", title: "Nagranie Warsztatu", type: "recording", completed: false },
          { id: "3-3", title: "Zadanie 1: Oferta nieruchomości", type: "task", completed: false },
        ],
      },
      {
        id: 4,
        title: "WARSZTAT 4: Budowa Strony Sprzedażowej",
        lessons: [
          { id: "4-1", title: "Proces: Strona z AI", type: "process", completed: false },
          { id: "4-2", title: "Nagranie Warsztatu", type: "recording", completed: false },
          { id: "4-3", title: "Zadanie 1: Landing page", type: "task", completed: false },
        ],
      },
      {
        id: 5,
        title: "WARSZTAT 5: Budowa z AI + COO",
        lessons: [
          { id: "5-1", title: "Proces: COO — Twój asystent operacyjny", type: "process", completed: false },
          { id: "5-2", title: "Nagranie Warsztatu", type: "recording", completed: false },
          { id: "5-3", title: "Zadanie 1: Stwórz COO", type: "task", completed: false },
        ],
      },
      {
        id: 6,
        title: "WARSZTAT 6: AI Na Komputerze",
        lessons: [
          { id: "6-1", title: "Proces: Claude Code + Terminal", type: "process", completed: false },
          { id: "6-2", title: "Nagranie Warsztatu", type: "recording", completed: false },
          { id: "6-3", title: "Zadanie 1: Instalacja Claude Code", type: "task", completed: false },
        ],
      },
      {
        id: 7,
        title: "WARSZTAT 7: Sprzedaż i CSO",
        lessons: [
          { id: "7-1", title: "Proces: CSO — Asystent sprzedaży", type: "process", completed: false },
          { id: "7-2", title: "Nagranie Warsztatu", type: "recording", completed: false },
          { id: "7-3", title: "Zadanie 1: Lejek sprzedażowy", type: "task", completed: false },
        ],
      },
      {
        id: 8,
        title: "WARSZTAT 8: Strategia i Content Marketing",
        lessons: [
          { id: "8-1", title: "Proces: Content Machine", type: "process", completed: false },
          { id: "8-2", title: "Nagranie Warsztatu", type: "recording", completed: false },
          { id: "8-3", title: "Zadanie 1: Plan contentowy", type: "task", completed: false },
        ],
      },
      {
        id: 9,
        title: "WARSZTAT 9: CMO & GHOST",
        lessons: [
          { id: "9-1", title: "Proces: CMO + GHOST", type: "process", completed: false },
          { id: "9-2", title: "Nagranie Warsztatu", type: "recording", completed: false },
          { id: "9-3", title: "Zadanie 1: Cyfrowy bliźniak", type: "task", completed: false },
        ],
      },
      {
        id: 10,
        title: "WARSZTAT 10: CEO",
        lessons: [
          { id: "10-1", title: "Proces: CEO", type: "process", completed: false },
          { id: "10-2", title: "Nagranie Warsztatu", type: "recording", completed: false },
          { id: "10-3", title: "Zadanie 1: CEO", type: "task", completed: false },
          { id: "10-4", title: "Zadanie 2: Zaktualizuj cały system o CEO", type: "task", completed: false },
        ],
      },
    ],
  },
  "biblioteka": {
    title: "BIBLIOTEKA ZASOBÓW I BONUSY",
    modules: [
      {
        id: 1,
        title: "Prompty uniwersalne",
        lessons: [
          { id: "b-1", title: "Profil Express", type: "process", completed: false },
          { id: "b-2", title: "Persona kupującego", type: "process", completed: false },
          { id: "b-3", title: "Persona sprzedającego", type: "process", completed: false },
          { id: "b-4", title: "Instrukcja projektu", type: "process", completed: false },
          { id: "b-5", title: "Ghost — Cyfrowy bliźniak", type: "process", completed: false },
        ],
      },
      {
        id: 2,
        title: "Checklisty",
        lessons: [
          { id: "b-6", title: "Checklista strony sprzedażowej", type: "process", completed: false },
          { id: "b-7", title: "Psychologia zakupowa B2C", type: "process", completed: false },
          { id: "b-8", title: "Lead magnet + popup", type: "process", completed: false },
        ],
      },
      {
        id: 3,
        title: "Poradniki",
        lessons: [
          { id: "b-9", title: "Budowa strony WWW", type: "process", completed: false },
          { id: "b-10", title: "Rolki i video", type: "process", completed: false },
          { id: "b-11", title: "Boty Telegram & WhatsApp", type: "process", completed: false },
        ],
      },
    ],
  },
  "nagrania-qa": {
    title: "NAGRANIA SPOTKAŃ Q&A",
    modules: [
      {
        id: 1,
        title: "Spotkania Q&A",
        lessons: [
          { id: "q-1", title: "Q&A — Edycja I, Spotkanie 1", type: "recording", completed: false, content: "Nagranie zostanie udostępnione po spotkaniu." },
        ],
      },
    ],
  },
  "narzedzia": {
    title: "NARZĘDZIA AI — WSZYSTKIE EDYCJE",
    modules: [
      {
        id: 1,
        title: "Narzędzia AI",
        lessons: [
          { id: "n-1", title: "Claude.ai — Podstawy", type: "process", completed: false },
          { id: "n-2", title: "Claude Code — Terminal AI", type: "process", completed: false },
          { id: "n-3", title: "Gemini — Google AI", type: "process", completed: false },
          { id: "n-4", title: "NotebookLM — Research", type: "process", completed: false },
          { id: "n-5", title: "Lovable — Budowa stron", type: "process", completed: false },
        ],
      },
    ],
  },
};

function LessonTypeLabel({ type }: { type: Lesson["type"] }) {
  const config = {
    process: { label: "Materiał", color: "text-blue-500", bg: "bg-blue-500/10" },
    recording: { label: "Nagranie", color: "text-red-400", bg: "bg-red-400/10" },
    task: { label: "Zadanie", color: "text-gold", bg: "bg-gold/10" },
  };
  const c = config[type];
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider ${c.color} ${c.bg} px-2 py-0.5 rounded-md`}>
      {c.label}
    </span>
  );
}

function LessonIcon({ type, completed }: { type: Lesson["type"]; completed: boolean }) {
  if (completed) {
    return (
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
    );
  }

  if (type === "recording") {
    return (
      <div className="w-6 h-6 rounded-full bg-red-400/10 flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    );
  }
  if (type === "task") {
    return (
      <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 text-gold" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
      <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    </div>
  );
}

export default function CoursePage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const course = courseData[courseId];

  const [openModules, setOpenModules] = useState<number[]>(course ? [course.modules[0]?.id] : []);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(
    course?.modules[0]?.lessons[0] || null
  );

  if (!course) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-light flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-foreground/20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-foreground/40">Kurs nie został znaleziony.</p>
        </div>
      </div>
    );
  }

  const toggleModule = (id: number) => {
    setOpenModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedLessons = course.modules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.completed).length, 0
  );
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="flex gap-0 -mx-4 sm:-mx-6 -mt-8 animate-fade-in">
      {/* Left sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-border bg-card overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
        {/* Back + title */}
        <div className="p-5 border-b border-border">
          <Link href="/classroom" className="inline-flex items-center gap-1.5 text-xs text-foreground/40 hover:text-gold transition-colors mb-4 group">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Wróć do materiałów
          </Link>
          <h2 className="font-heading text-sm font-semibold text-foreground uppercase tracking-widest leading-relaxed">
            {course.title}
          </h2>
          <div className="mt-4">
            <div className="flex justify-between text-[11px] mb-2">
              <span className="text-foreground/40">{progressPercent}% ukończono</span>
              <span className="text-foreground/30 tabular-nums">{completedLessons}/{totalLessons}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-light rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-gold-dark rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Modules */}
        <div className="py-1">
          {course.modules.map((mod, modIndex) => {
            const isOpen = openModules.includes(mod.id);
            const modCompleted = mod.lessons.filter((l) => l.completed).length;
            return (
              <div key={mod.id} className={modIndex > 0 ? "border-t border-border/50" : ""}>
                <button
                  onClick={() => toggleModule(mod.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-light/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <span className="text-[11px] font-semibold text-foreground block truncate leading-relaxed">
                      {mod.title}
                    </span>
                    <span className="text-[10px] text-foreground/30 mt-0.5">
                      {modCompleted}/{mod.lessons.length} lekcji
                    </span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-foreground/25 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="pb-2 stagger-children">
                    {mod.lessons.map((lesson) => {
                      const isSelected = selectedLesson?.id === lesson.id;
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => setSelectedLesson(lesson)}
                          className={`w-full flex items-center gap-3 px-5 pl-7 py-2.5 text-left text-[13px] transition-all duration-150 ${
                            isSelected
                              ? "bg-gold/8 text-foreground border-l-2 border-gold ml-0"
                              : "text-foreground/55 hover:bg-slate-light/70 hover:text-foreground border-l-2 border-transparent ml-0"
                          }`}
                        >
                          <LessonIcon type={lesson.type} completed={lesson.completed} />
                          <span className="truncate flex-1">{lesson.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right content */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
        {selectedLesson ? (
          <div className="p-8 lg:p-12 max-w-3xl animate-fade-in">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-6">
              <LessonTypeLabel type={selectedLesson.type} />
            </div>

            <div className="flex items-start justify-between mb-8">
              <h1 className="text-2xl font-heading font-semibold text-foreground tracking-wide leading-relaxed">
                {selectedLesson.title}
              </h1>
              <button
                className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ml-4 ${
                  selectedLesson.completed
                    ? "bg-gradient-to-br from-gold to-gold-dark border-gold text-white shadow-sm"
                    : "border-foreground/15 hover:border-gold hover:bg-gold/5"
                }`}
                title={selectedLesson.completed ? "Ukończone" : "Oznacz jako ukończone"}
              >
                {selectedLesson.completed && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </button>
            </div>

            <div className="gold-line mb-8" />

            {selectedLesson.content ? (
              <div className="text-foreground/70 leading-[1.8] text-[15px] whitespace-pre-line">
                {selectedLesson.content}
              </div>
            ) : (
              <div className="bg-slate-light rounded-2xl p-8 text-center">
                <svg className="w-10 h-10 text-foreground/15 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <p className="text-foreground/35 text-sm">Treść zostanie dodana wkrótce.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-foreground/30">
            <div className="text-center">
              <svg className="w-12 h-12 text-foreground/10 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
              <p className="text-sm">Wybierz lekcję z menu po lewej</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
