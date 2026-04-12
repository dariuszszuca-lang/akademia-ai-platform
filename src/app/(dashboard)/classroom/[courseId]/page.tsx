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
          { id: "s-1", title: "Witaj w Akademii AI!", type: "process", completed: false, content: "Witaj w Akademii AI! To jest Twoja platforma szkoleniowa.\n\nTutaj znajdziesz:\n- Materiały z każdego warsztatu\n- Nagrania sesji\n- Zadania do wykonania\n- Społeczność uczestników\n\nZacznij od przejrzenia zakładek w panelu nawigacji." },
          { id: "s-2", title: "Jak korzystać z platformy", type: "process", completed: false, content: "Krótki poradnik jak poruszać się po platformie:\n\n1. Społeczność — posty, pytania, dyskusje\n2. Materiały — kursy, nagrania, zadania\n3. Kalendarz — harmonogram warsztatów\n4. Członkowie — lista uczestników\n5. O nas — informacje o Akademii" },
          { id: "s-3", title: "Zadanie: Przedstaw się", type: "task", completed: false, content: "Wejdź do zakładki Społeczność i napisz krótki post:\n\n- Kim jesteś?\n- Czym się zajmujesz?\n- Co chcesz osiągnąć dzięki AI?\n\nTo pomoże nam lepiej dopasować warsztaty do Twoich potrzeb." },
        ],
      },
    ],
  },
  "przygotowanie": {
    title: "PRZYGOTOWANIE (Praca domowa)",
    modules: [
      {
        id: 1,
        title: "Przygotowanie do warsztatu",
        lessons: [
          { id: "p-1", title: "Profil przedsiębiorcy", type: "task", completed: false, content: "Materiały zostaną udostępnione przed warsztacie." },
          { id: "p-2", title: "Persona kupującego", type: "task", completed: false, content: "Materiały zostaną udostępnione przed warsztacie." },
          { id: "p-3", title: "Persona sprzedającego", type: "task", completed: false, content: "Materiały zostaną udostępnione przed warsztacie." },
          { id: "p-4", title: "Oferta — Twoja propozycja wartości", type: "task", completed: false, content: "Materiały zostaną udostępnione przed warsztacie." },
          { id: "p-5", title: "Konfiguracja kont AI (Claude, Gemini)", type: "process", completed: false, content: "Materiały zostaną udostępnione przed warsztacie." },
          { id: "p-6", title: "Pobranie asystentów (COO, CAO, CNO)", type: "process", completed: false, content: "Materiały zostaną udostępnione przed warsztacie." },
        ],
      },
    ],
  },
  "dzien-1": {
    title: "DZIEŃ 1: Twój AI Team w Akcji",
    modules: [
      {
        id: 1,
        title: "Blok 1: Weryfikacja + Konfiguracja",
        lessons: [
          { id: "d1-1", title: "Weryfikacja + Konfiguracja projektu", type: "process", completed: false, content: "Materiały zostaną udostępnione po warsztacie." },
        ],
      },
      {
        id: 2,
        title: "Blok 2: GHOST — Styl pisania",
        lessons: [
          { id: "d1-2", title: "GHOST — Twój styl pisania z AI", type: "process", completed: false, content: "Materiały zostaną udostępnione po warsztacie." },
        ],
      },
      {
        id: 3,
        title: "Blok 3: Wideo, rolki, posty bez kamery",
        lessons: [
          { id: "d1-3", title: "Wideo/rolki/posty bez kamery", type: "process", completed: false, content: "Materiały zostaną udostępnione po warsztacie." },
        ],
      },
      {
        id: 4,
        title: "Blok 4: Mój AI Team",
        lessons: [
          { id: "d1-4", title: "Mój AI Team — budowa zespołu asystentów", type: "process", completed: false, content: "Materiały zostaną udostępnione po warsztacie." },
        ],
      },
      {
        id: 5,
        title: "Blok 5: Narzędzia agenta",
        lessons: [
          { id: "d1-5", title: "Narzędzia agenta (wycena/CMA/opisy/prospecting)", type: "process", completed: false, content: "Materiały zostaną udostępnione po warsztacie." },
        ],
      },
      {
        id: 6,
        title: "Blok 6: Plan działania + Decyzje",
        lessons: [
          { id: "d1-6", title: "Plan działania + decyzje", type: "process", completed: false, content: "Materiały zostaną udostępnione po warsztacie." },
        ],
      },
      {
        id: 7,
        title: "Nagranie",
        lessons: [
          { id: "d1-7", title: "Nagranie warsztatu — Dzień 1", type: "recording", completed: false, content: "Nagranie zostanie udostępnione po warsztacie." },
        ],
      },
    ],
  },
  "dzien-2": {
    title: "DZIEŃ 2: Zaawansowane AI + Automatyzacja",
    modules: [
      {
        id: 1,
        title: "Blok 1: Instalacja lokalna",
        lessons: [
          { id: "d2-1", title: "Instalacja lokalna AI na komputerze", type: "process", completed: false, content: "Materiały zostaną udostępnione po warsztacie." },
        ],
      },
      {
        id: 2,
        title: "Blok 2: Obsługa asystentów / Terminal",
        lessons: [
          { id: "d2-2", title: "Obsługa asystentów i terminala", type: "process", completed: false, content: "Materiały zostaną udostępnione po warsztacie." },
        ],
      },
      {
        id: 3,
        title: "Blok 3: Skille / API / MCP",
        lessons: [
          { id: "d2-3", title: "Skille, API, MCP — rozszerzenia AI", type: "process", completed: false, content: "Materiały zostaną udostępnione po warsztacie." },
        ],
      },
      {
        id: 4,
        title: "Blok 4: Automatyzacje zadań",
        lessons: [
          { id: "d2-4", title: "Automatyzacje codziennych zadań", type: "process", completed: false, content: "Materiały zostaną udostępnione po warsztacie." },
        ],
      },
      {
        id: 5,
        title: "Blok 5: Łączenie z narzędziami",
        lessons: [
          { id: "d2-5", title: "Łączenie z narzędziami (mail/kalendarz/CRM)", type: "process", completed: false, content: "Materiały zostaną udostępnione po warsztacie." },
        ],
      },
      {
        id: 6,
        title: "Blok 6: Test + Certyfikat",
        lessons: [
          { id: "d2-6", title: "Test końcowy + Certyfikat", type: "task", completed: false, content: "Materiały zostaną udostępnione po warsztacie." },
        ],
      },
      {
        id: 7,
        title: "Nagranie",
        lessons: [
          { id: "d2-7", title: "Nagranie warsztatu — Dzień 2", type: "recording", completed: false, content: "Nagranie zostanie udostępnione po warsztacie." },
        ],
      },
    ],
  },
  "nagrania-qa": {
    title: "NAGRANIA Q&A",
    modules: [
      {
        id: 1,
        title: "Spotkania Q&A",
        lessons: [
          { id: "q-1", title: "Q&A — Edycja #1, Spotkanie 1", type: "recording", completed: false, content: "Nagranie zostanie udostępnione po spotkaniu." },
        ],
      },
    ],
  },
  "biblioteka": {
    title: "BIBLIOTEKA ZASOBÓW",
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
  "narzedzia": {
    title: "NARZĘDZIA AI",
    modules: [
      {
        id: 1,
        title: "Narzędzia AI",
        lessons: [
          { id: "n-1", title: "Claude.ai — Podstawy", type: "process", completed: false },
          { id: "n-2", title: "Gemini — Google AI", type: "process", completed: false },
          { id: "n-3", title: "NotebookLM — Research", type: "process", completed: false },
          { id: "n-4", title: "Lovable — Budowa stron", type: "process", completed: false },
          { id: "n-5", title: "Claude Code — Terminal AI", type: "process", completed: false },
        ],
      },
    ],
  },
};

function LessonTypeLabel({ type }: { type: Lesson["type"] }) {
  const config = {
    process: { label: "Materiał", color: "text-blue-500", bg: "bg-blue-500/10" },
    recording: { label: "Nagranie", color: "text-red-400", bg: "bg-red-400/10" },
    task: { label: "Zadanie", color: "text-accent", bg: "bg-accent/10" },
  };
  const c = config[type];
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-wide ${c.color} ${c.bg} px-2.5 py-1 rounded-md`}>
      {c.label}
    </span>
  );
}

function LessonIcon({ type, completed }: { type: Lesson["type"]; completed: boolean }) {
  if (completed) {
    return (
      <div className="w-5 h-5 bg-accent rounded-md flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
    );
  }

  const colors = {
    recording: { bg: "rgba(248, 113, 113, 0.1)", fg: "#f87171" },
    task: { bg: "var(--accent-light)", fg: "var(--accent)" },
    process: { bg: "rgba(59, 130, 246, 0.1)", fg: "#60a5fa" },
  };
  const c = colors[type];

  return (
    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 rounded-md" style={{ background: c.bg }}>
      {type === "recording" ? (
        <svg className="w-2.5 h-2.5" fill={c.fg} viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
      ) : type === "task" ? (
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={c.fg}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
        </svg>
      ) : (
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={c.fg}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
      )}
    </div>
  );
}

export default function CoursePage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const course = courseData[courseId];

  const [activeModuleId, setActiveModuleId] = useState<number>(course?.modules[0]?.id || 1);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(
    course?.modules[0]?.lessons[0] || null
  );

  if (!course) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-light rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-foreground/20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-foreground/40">Kurs nie został znaleziony.</p>
        </div>
      </div>
    );
  }

  const activeModule = course.modules.find((m) => m.id === activeModuleId) || course.modules[0];
  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedLessons = course.modules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.completed).length, 0
  );
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="animate-fade-in">
      {/* Back + Course title */}
      <div className="mb-6">
        <Link href="/classroom" className="inline-flex items-center gap-1.5 text-xs text-foreground/40 hover:text-accent transition-colors mb-5 group">
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Wróć do materiałów
        </Link>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          {course.title}
        </h2>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-3 flex-1 max-w-xs">
            <div className="flex-1 h-2 bg-slate-light rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[11px] text-foreground/30 tabular-nums">{progressPercent}% ({completedLessons}/{totalLessons})</span>
          </div>
        </div>
      </div>

      {/* Module chips */}
      <div className="border-b border-border mb-8 overflow-x-auto">
        <div className="flex">
          {course.modules.map((mod) => {
            const isActive = mod.id === activeModuleId;
            return (
              <button
                key={mod.id}
                onClick={() => {
                  setActiveModuleId(mod.id);
                  setSelectedLesson(mod.lessons[0] || null);
                }}
                className={`module-chip ${isActive ? "active" : ""}`}
              >
                {mod.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lessons list + Content */}
      <div className="max-w-4xl">
        {/* Lesson picker */}
        <div className="flex flex-wrap gap-2 mb-8">
          {activeModule.lessons.map((lesson) => {
            const isSelected = selectedLesson?.id === lesson.id;
            return (
              <button
                key={lesson.id}
                onClick={() => setSelectedLesson(lesson)}
                className={`flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium transition-all duration-150 border rounded-lg ${
                  isSelected
                    ? "border-accent/40 bg-accent/5 text-foreground"
                    : "border-border text-foreground/40 hover:border-accent/20 hover:text-foreground/70"
                }`}
              >
                <LessonIcon type={lesson.type} completed={lesson.completed} />
                <span className="truncate">{lesson.title}</span>
              </button>
            );
          })}
        </div>

        {/* Content area */}
        {selectedLesson ? (
          <div className="animate-fade-in bg-card border border-border rounded-xl p-6 sm:p-8">
            {/* Type label */}
            <div className="mb-4">
              <LessonTypeLabel type={selectedLesson.type} />
            </div>

            <div className="flex items-start justify-between mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-snug">
                {selectedLesson.title}
              </h1>
              <button
                className={`w-8 h-8 border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ml-4 rounded-lg ${
                  selectedLesson.completed
                    ? "bg-accent border-accent text-white"
                    : "border-foreground/15 hover:border-accent hover:bg-accent/5"
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

            {selectedLesson.content ? (
              <div className="text-foreground/60 leading-relaxed text-[15px] whitespace-pre-line">
                {selectedLesson.content}
              </div>
            ) : (
              <div className="bg-slate-light p-8 text-center rounded-xl">
                <svg className="w-10 h-10 text-foreground/10 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <p className="text-foreground/30 text-sm">Treść zostanie dodana wkrótce.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-16 text-foreground/20">
            <div className="text-center">
              <svg className="w-12 h-12 text-foreground/10 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
              <p className="text-sm">Wybierz lekcję powyżej</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
