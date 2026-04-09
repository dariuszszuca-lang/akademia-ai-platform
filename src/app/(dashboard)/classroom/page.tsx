"use client";

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
  lessons: Lesson[];
};

const modules: Module[] = [
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
      { id: "2-2", title: "Nagranie Warsztatu", type: "recording", completed: false, content: "Nagranie zostanie udostępnione po warsztacie." },
      { id: "2-3", title: "Zadanie 1: Analiza konkurencji", type: "task", completed: false, content: "Przeanalizuj 5 konkurentów w Twojej okolicy z pomocą AI." },
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
];

function LessonIcon({ type }: { type: Lesson["type"] }) {
  if (type === "recording") {
    return (
      <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
    );
  }
  if (type === "task") {
    return (
      <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

export default function ClassroomPage() {
  const [openModules, setOpenModules] = useState<number[]>([1]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(modules[0].lessons[0]);

  const toggleModule = (id: number) => {
    setOpenModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedLessons = modules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.completed).length,
    0
  );
  const progressPercent = Math.round((completedLessons / totalLessons) * 100);

  return (
    <div className="flex gap-0 max-w-7xl -mx-4 sm:-mx-6">
      {/* Left sidebar — modules */}
      <div className="w-80 flex-shrink-0 border-r border-border bg-card overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm uppercase tracking-wider">
            Akademia AI — Edycja I
          </h2>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-foreground/50 mb-1">
              <span>{progressPercent}% ukończono</span>
              <span>{completedLessons}/{totalLessons}</span>
            </div>
            <div className="w-full h-2 bg-slate-light rounded-full overflow-hidden">
              <div
                className="h-full bg-gold rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="py-2">
          {modules.map((mod) => {
            const isOpen = openModules.includes(mod.id);
            return (
              <div key={mod.id}>
                <button
                  onClick={() => toggleModule(mod.id)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-light/50 transition-colors"
                >
                  <span className="text-sm font-semibold text-foreground truncate pr-2">
                    {mod.title}
                  </span>
                  <svg
                    className={`w-4 h-4 text-foreground/40 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="pb-2">
                    {mod.lessons.map((lesson) => {
                      const isSelected = selectedLesson?.id === lesson.id;
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => setSelectedLesson(lesson)}
                          className={`w-full flex items-center gap-3 px-8 py-2.5 text-left text-sm transition-colors ${
                            isSelected
                              ? "bg-gold/10 text-gold border-r-2 border-gold"
                              : "text-foreground/70 hover:bg-slate-light/50 hover:text-foreground"
                          }`}
                        >
                          <LessonIcon type={lesson.type} />
                          <span className="truncate">{lesson.title}</span>
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

      {/* Right content — lesson detail */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
        {selectedLesson ? (
          <div className="p-8 max-w-3xl">
            <div className="flex items-start justify-between mb-6">
              <h1 className="text-2xl font-semibold text-foreground">{selectedLesson.title}</h1>
              <button
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  selectedLesson.completed
                    ? "bg-gold border-gold text-white"
                    : "border-foreground/20 hover:border-gold"
                }`}
              >
                {selectedLesson.completed && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </button>
            </div>

            {selectedLesson.content ? (
              <div className="text-foreground/80 leading-relaxed whitespace-pre-line">
                {selectedLesson.content}
              </div>
            ) : (
              <p className="text-foreground/40">Treść zostanie dodana wkrótce.</p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-foreground/40">
            <p>Wybierz lekcję z menu po lewej</p>
          </div>
        )}
      </div>
    </div>
  );
}
