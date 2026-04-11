"use client";

import Link from "next/link";

type Course = {
  id: string;
  title: string;
  description: string;
  progress: number;
  gradientFrom: string;
  gradientTo: string;
  icon: string;
  lessons: number;
  locked?: boolean;
};

const courses: Course[] = [
  {
    id: "start",
    title: "START TUTAJ",
    description: "Witaj w Akademii AI! To Twój pierwszy i najważniejszy przystanek. Zapoznaj się z platformą i przygotuj do warsztatów.",
    progress: 0,
    gradientFrom: "#10b981",
    gradientTo: "#0d9488",
    icon: "01",
    lessons: 3,
  },
  {
    id: "edycja-1",
    title: "AKADEMIA AI — EDYCJA I",
    description: "Serce programu — 10 warsztatów z AI w nieruchomościach. Budowa asystentów, automatyzacja, content, sprzedaż.",
    progress: 0,
    gradientFrom: "#6366f1",
    gradientTo: "#7c3aed",
    icon: "02",
    lessons: 30,
  },
  {
    id: "biblioteka",
    title: "BIBLIOTEKA ZASOBÓW I BONUSY",
    description: "Twój skarbiec i przewaga nad konkurencją. Znajdziesz tu prompty, checklisty, poradniki i szablony.",
    progress: 0,
    gradientFrom: "#f59e0b",
    gradientTo: "#ea580c",
    icon: "03",
    lessons: 11,
  },
  {
    id: "nagrania-qa",
    title: "NAGRANIA SPOTKAŃ Q&A",
    description: "Przegapiłeś LIVE Q&A w sobotę lub chcesz do czegoś wrócić? To jest Twoje osobiste archiwum.",
    progress: 0,
    gradientFrom: "#f43f5e",
    gradientTo: "#ec4899",
    icon: "04",
    lessons: 1,
  },
  {
    id: "narzedzia",
    title: "NARZĘDZIA AI — WSZYSTKIE EDYCJE",
    description: "Materiały z narzędzi AI zaprezentowanych na warsztatach. Dostęp do najnowszych toolów i instrukcji.",
    progress: 0,
    gradientFrom: "#06b6d4",
    gradientTo: "#3b82f6",
    icon: "05",
    lessons: 5,
  },
  {
    id: "archiwum",
    title: "ARCHIWUM: POPRZEDNIE EDYCJE",
    description: "Materiały z poprzednich edycji warsztatów. Dostęp dla absolwentów.",
    progress: 0,
    gradientFrom: "#6b7280",
    gradientTo: "#4b5563",
    icon: "06",
    lessons: 0,
    locked: true,
  },
];

export default function ClassroomPage() {
  return (
    <div className="animate-fade-in">
      {/* Section header */}
      <div className="mb-10">
        <h2 className="font-heading text-4xl font-bold text-foreground tracking-wide gold-glow-text">
          Materiały
        </h2>
        <p className="text-sm text-foreground/35 mt-2 font-light tracking-wide">Wybierz kurs aby zobaczyć moduły i lekcje</p>
        <div className="w-24 h-px bg-gradient-to-r from-gold to-transparent mt-4" />
      </div>

      {/* List layout — full-width horizontal rows */}
      <div className="space-y-3 stagger-children max-w-4xl">
        {courses.map((course) => (
          <Link
            key={course.id}
            href={course.locked ? "#" : `/classroom/${course.id}`}
            className={`block course-row-accent group ${
              course.locked ? "opacity-40 cursor-not-allowed" : ""
            }`}
          >
            <div
              className="flex items-center gap-6 bg-card border border-border p-5 pr-8 transition-all duration-200 hover:border-gold/20 group-hover:bg-card/80"
              style={{
                borderLeft: `4px solid ${course.gradientFrom}`,
                borderRadius: "0",
              }}
            >
              {/* Large course number */}
              <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${course.gradientFrom}15, ${course.gradientTo}08)`,
                }}
              >
                <span className="font-heading text-xl font-bold" style={{ color: course.gradientFrom, opacity: 0.7 }}>
                  {course.icon}
                </span>
              </div>

              {/* Course info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-heading text-xs font-semibold text-foreground uppercase tracking-[0.15em] group-hover:text-gold transition-colors duration-200">
                  {course.title}
                </h3>
                <p className="text-xs text-foreground/40 leading-relaxed mt-1 line-clamp-1">
                  {course.description}
                </p>
              </div>

              {/* Right side — lessons count + progress */}
              <div className="flex items-center gap-6 flex-shrink-0">
                {!course.locked && (
                  <>
                    <div className="text-right">
                      <span className="text-xs text-foreground/25 tabular-nums">{course.lessons} lekcji</span>
                    </div>
                    <div className="flex items-center gap-3 w-32">
                      <div className="flex-1 h-1 bg-slate-light overflow-hidden" style={{ borderRadius: "0" }}>
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${Math.max(course.progress, 2)}%`,
                            background: course.progress > 0
                              ? `linear-gradient(90deg, ${course.gradientFrom}, ${course.gradientTo})`
                              : "var(--border)",
                          }}
                        />
                      </div>
                      <span className={`text-[11px] font-semibold tabular-nums ${course.progress > 0 ? "text-gold" : "text-foreground/20"}`}>
                        {course.progress}%
                      </span>
                    </div>
                  </>
                )}
                {course.locked && (
                  <div className="flex items-center gap-2 text-foreground/25">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    <span className="text-[10px] uppercase tracking-wider font-medium">Prywatny</span>
                  </div>
                )}

                {/* Arrow */}
                {!course.locked && (
                  <svg className="w-4 h-4 text-foreground/15 group-hover:text-gold group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
