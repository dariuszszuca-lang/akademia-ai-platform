"use client";

import Link from "next/link";

type Course = {
  id: string;
  title: string;
  description: string;
  progress: number;
  accentColor: string;
  icon: string;
  lessons: number;
  locked?: boolean;
  external?: string;
};

const courses: Course[] = [
  {
    id: "start",
    title: "START TUTAJ",
    description: "Witaj w Akademii AI! To Twój pierwszy i najważniejszy przystanek. Zapoznaj się z platformą, przygotuj narzędzia i poznaj plan warsztatów.",
    progress: 0,
    accentColor: "#10b981",
    icon: "01",
    lessons: 3,
  },
  {
    id: "edycja-1",
    title: "AKADEMIA AI — EDYCJA I",
    description: "Serce programu — 10 warsztatów z AI w nieruchomościach. Budowa asystentów, automatyzacja procesów, content marketing, sprzedaż z AI, budowa stron.",
    progress: 0,
    accentColor: "#6366f1",
    icon: "02",
    lessons: 30,
  },
  {
    id: "biblioteka",
    title: "BIBLIOTEKA ZASOBÓW I BONUSY",
    description: "Twój skarbiec i przewaga nad konkurencją. Prompty uniwersalne, checklisty stron sprzedażowych, psychologia zakupowa, poradniki krok po kroku.",
    progress: 0,
    accentColor: "#f59e0b",
    icon: "03",
    lessons: 11,
  },
  {
    id: "nagrania-qa",
    title: "NAGRANIA SPOTKAŃ Q&A",
    description: "Przegapiłeś LIVE Q&A w sobotę lub chcesz do czegoś wrócić? To jest Twoje osobiste archiwum wszystkich sesji pytań i odpowiedzi.",
    progress: 0,
    accentColor: "#f43f5e",
    icon: "04",
    lessons: 1,
  },
  {
    id: "narzedzia",
    title: "NARZĘDZIA AI — WSZYSTKIE EDYCJE",
    description: "Materiały z narzędzi AI zaprezentowanych na warsztatach. Claude, Gemini, NotebookLM, Lovable i więcej — instrukcje i przykłady użycia.",
    progress: 0,
    accentColor: "#06b6d4",
    icon: "05",
    lessons: 5,
  },
  {
    id: "rct",
    title: "REJESTR CEN TRANSAKCYJNYCH",
    description: "Oficjalny rejestr cen nieruchomości z aktów notarialnych. Darmowy dostęp do rzeczywistych cen transakcyjnych — niezbędne narzędzie każdego agenta.",
    progress: 0,
    accentColor: "#8b5cf6",
    icon: "06",
    lessons: 0,
    external: "https://rejestrcentransakcyjnych.pl",
  },
  {
    id: "archiwum",
    title: "ARCHIWUM: POPRZEDNIE EDYCJE",
    description: "Materiały z poprzednich edycji warsztatów. Dostęp dla absolwentów.",
    progress: 0,
    accentColor: "#6b7280",
    icon: "07",
    lessons: 0,
    locked: true,
  },
];

function CourseCard({ course }: { course: Course }) {
  const cardContent = (
    <div
      className={`relative overflow-hidden bg-card border border-border rounded-2xl transition-all duration-300 ${
        course.locked ? "opacity-40 grayscale" : "card-hover cursor-pointer group"
      }`}
    >
      {/* Colored top accent bar */}
      <div
        className="h-1.5 w-full"
        style={{ background: course.locked ? "#6b7280" : course.accentColor }}
      />

      {/* Subtle radial glow in top-right */}
      {!course.locked && (
        <div
          className="absolute top-0 right-0 w-40 h-40 opacity-[0.06]"
          style={{ background: `radial-gradient(circle, ${course.accentColor} 0%, transparent 70%)` }}
        />
      )}

      <div className="p-5 sm:p-6">
        {/* Top row: Number + Lock/Arrow */}
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${course.accentColor}15` }}
          >
            <span
              className="font-heading text-base font-bold"
              style={{ color: course.accentColor }}
            >
              {course.icon}
            </span>
          </div>

          {course.locked ? (
            <svg className="w-5 h-5 text-foreground/20 mt-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-foreground/15 group-hover:text-gold group-hover:translate-x-0.5 transition-all mt-1"
              fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          )}
        </div>

        {/* Title */}
        <h3 className="font-heading text-sm font-bold text-foreground uppercase tracking-[0.08em] leading-snug group-hover:text-gold transition-colors">
          {course.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-foreground/45 mt-2 leading-relaxed line-clamp-2">
          {course.description}
        </p>

        {/* Bottom section: progress + lesson count */}
        {!course.locked && (
          <div className="mt-4 pt-4 border-t border-border/50">
            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-slate-light rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(course.progress, 3)}%`,
                    background: course.progress > 0
                      ? `linear-gradient(90deg, ${course.accentColor}, ${course.accentColor}cc)`
                      : "var(--border)",
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-foreground/40 tabular-nums w-8 text-right">
                {course.progress}%
              </span>
            </div>

            {/* Lesson count */}
            {course.lessons > 0 && (
              <div className="flex items-center justify-between mt-2.5">
                <span className="text-[11px] text-foreground/30 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                  {course.lessons} lekcji
                </span>
                {course.external && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: course.accentColor }}>
                    Zewnętrzne
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (course.locked) {
    return cardContent;
  }

  if (course.external) {
    return (
      <a href={course.external} target="_blank" rel="noopener noreferrer">
        {cardContent}
      </a>
    );
  }

  return (
    <Link href={`/classroom/${course.id}`}>
      {cardContent}
    </Link>
  );
}

export default function ClassroomPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-10">
        <h2 className="font-heading text-4xl font-bold text-foreground tracking-wide gold-glow-text">
          Materiały
        </h2>
        <p className="text-sm text-foreground/35 mt-2 font-light tracking-wide">
          Wybierz kurs aby rozpocząć naukę
        </p>
        <div className="w-24 h-px bg-gradient-to-r from-gold to-transparent mt-4" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children pb-24">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </div>
  );
}
