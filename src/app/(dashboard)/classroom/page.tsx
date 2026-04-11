"use client";

import Link from "next/link";

type Course = {
  id: string;
  title: string;
  description: string;
  progress: number;
  color: string;
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
    color: "from-emerald-500 via-emerald-600 to-teal-700",
    icon: "01",
    lessons: 3,
  },
  {
    id: "edycja-1",
    title: "AKADEMIA AI — EDYCJA I",
    description: "Serce programu — 10 warsztatów z AI w nieruchomościach. Budowa asystentów, automatyzacja, content, sprzedaż.",
    progress: 0,
    color: "from-indigo-500 via-indigo-600 to-purple-700",
    icon: "02",
    lessons: 30,
  },
  {
    id: "biblioteka",
    title: "BIBLIOTEKA ZASOBÓW I BONUSY",
    description: "Twój skarbiec i przewaga nad konkurencją. Znajdziesz tu prompty, checklisty, poradniki i szablony.",
    progress: 0,
    color: "from-amber-500 via-amber-600 to-orange-700",
    icon: "03",
    lessons: 11,
  },
  {
    id: "nagrania-qa",
    title: "NAGRANIA SPOTKAŃ Q&A",
    description: "Przegapiłeś LIVE Q&A w sobotę lub chcesz do czegoś wrócić? To jest Twoje osobiste archiwum.",
    progress: 0,
    color: "from-rose-500 via-rose-600 to-pink-700",
    icon: "04",
    lessons: 1,
  },
  {
    id: "narzedzia",
    title: "NARZĘDZIA AI — WSZYSTKIE EDYCJE",
    description: "Materiały z narzędzi AI zaprezentowanych na warsztatach. Dostęp do najnowszych toolów i instrukcji.",
    progress: 0,
    color: "from-cyan-500 via-cyan-600 to-blue-700",
    icon: "05",
    lessons: 5,
  },
  {
    id: "archiwum",
    title: "ARCHIWUM: POPRZEDNIE EDYCJE",
    description: "Materiały z poprzednich edycji warsztatów. Dostęp dla absolwentów.",
    progress: 0,
    color: "from-gray-500 via-gray-600 to-gray-700",
    icon: "06",
    lessons: 0,
    locked: true,
  },
];

export default function ClassroomPage() {
  return (
    <div className="max-w-5xl animate-fade-in">
      {/* Section header */}
      <div className="mb-8">
        <h2 className="font-heading text-2xl font-semibold text-foreground tracking-wide">Materiały szkoleniowe</h2>
        <p className="text-sm text-foreground/40 mt-1">Wybierz kurs aby zobaczyć moduły i lekcje</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
        {courses.map((course) => (
          <Link
            key={course.id}
            href={course.locked ? "#" : `/classroom/${course.id}`}
            className={`bg-card rounded-2xl border border-border overflow-hidden card-hover group ${
              course.locked ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {/* Cover */}
            <div className={`h-36 bg-gradient-to-br ${course.color} relative overflow-hidden`}>
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />

              {course.locked ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/20">
                  <svg className="w-7 h-7 text-white/70" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  <span className="text-white/60 text-xs font-medium tracking-wider uppercase">Kurs prywatny</span>
                </div>
              ) : (
                <>
                  {/* Large number watermark */}
                  <span className="absolute top-3 right-4 text-5xl font-heading font-bold text-white/10 group-hover:text-white/20 transition-colors duration-300">
                    {course.icon}
                  </span>
                  {/* Lesson count badge */}
                  <div className="absolute bottom-3 left-4 flex items-center gap-1.5 bg-black/20 backdrop-blur-sm rounded-lg px-2.5 py-1">
                    <svg className="w-3.5 h-3.5 text-white/70" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                    <span className="text-white/80 text-[11px] font-medium">{course.lessons} lekcji</span>
                  </div>
                </>
              )}
            </div>

            {/* Info */}
            <div className="p-5">
              <h3 className="font-semibold text-foreground text-xs uppercase tracking-widest mb-2 group-hover:text-gold transition-colors duration-200">
                {course.title}
              </h3>
              <p className="text-xs text-foreground/45 leading-relaxed line-clamp-2 mb-5">
                {course.description}
              </p>

              {/* Progress */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-slate-light rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      course.progress > 0
                        ? "bg-gradient-to-r from-gold to-gold-dark"
                        : "bg-foreground/8"
                    }`}
                    style={{ width: `${Math.max(course.progress, 2)}%` }}
                  />
                </div>
                <span className={`text-[11px] font-semibold tabular-nums ${course.progress > 0 ? "text-gold" : "text-foreground/25"}`}>
                  {course.progress}%
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
