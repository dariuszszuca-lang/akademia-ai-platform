"use client";

import Link from "next/link";

type Course = {
  id: string;
  title: string;
  description: string;
  progress: number;
  color: string;
  locked?: boolean;
};

const courses: Course[] = [
  {
    id: "start",
    title: "START TUTAJ",
    description: "Witaj w Akademii AI! To Twój pierwszy i najważniejszy przystanek. Zapoznaj się z platformą i przygotuj do warsztatów.",
    progress: 0,
    color: "from-emerald-600 to-teal-800",
  },
  {
    id: "edycja-1",
    title: "AKADEMIA AI — EDYCJA I",
    description: "Serce programu — 10 warsztatów z AI w nieruchomościach. Budowa asystentów, automatyzacja, content, sprzedaż.",
    progress: 0,
    color: "from-indigo-600 to-purple-800",
  },
  {
    id: "biblioteka",
    title: "BIBLIOTEKA ZASOBÓW I BONUSY",
    description: "Twój skarbiec i przewaga nad konkurencją. Znajdziesz tu prompty, checklisty, poradniki i szablony.",
    progress: 0,
    color: "from-amber-600 to-orange-800",
  },
  {
    id: "nagrania-qa",
    title: "NAGRANIA SPOTKAŃ Q&A",
    description: "Przegapiłeś LIVE Q&A w sobotę lub chcesz do czegoś wrócić? To jest Twoje osobiste archiwum.",
    progress: 0,
    color: "from-rose-600 to-pink-800",
  },
  {
    id: "narzedzia",
    title: "NARZĘDZIA AI — WSZYSTKIE EDYCJE",
    description: "Materiały z narzędzi AI zaprezentowanych na warsztatach. Dostęp do najnowszych toolów i instrukcji.",
    progress: 0,
    color: "from-cyan-600 to-blue-800",
  },
  {
    id: "archiwum",
    title: "ARCHIWUM: POPRZEDNIE EDYCJE",
    description: "Materiały z poprzednich edycji warsztatów. Dostęp dla absolwentów.",
    progress: 0,
    color: "from-gray-600 to-gray-800",
    locked: true,
  },
];

export default function ClassroomPage() {
  return (
    <div className="max-w-5xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {courses.map((course) => (
          <Link
            key={course.id}
            href={course.locked ? "#" : `/classroom/${course.id}`}
            className={`bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-lg hover:border-gold/30 transition-all group ${
              course.locked ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {/* Cover image area */}
            <div className={`h-40 bg-gradient-to-br ${course.color} flex items-center justify-center relative`}>
              {course.locked ? (
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  <span className="text-white/80 text-sm font-medium">Kurs prywatny</span>
                </div>
              ) : (
                <span className="text-white/20 text-6xl font-heading font-bold group-hover:text-white/30 transition-colors">
                  {course.title.charAt(0)}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="p-5">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide mb-2 group-hover:text-gold-dark transition-colors">
                {course.title}
              </h3>
              <p className="text-xs text-foreground/50 leading-relaxed line-clamp-2 mb-4">
                {course.description}
              </p>

              {/* Progress */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-light rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      course.progress > 0 ? "bg-green-500" : "bg-foreground/10"
                    }`}
                    style={{ width: `${Math.max(course.progress, 3)}%` }}
                  />
                </div>
                <span className={`text-xs font-medium ${course.progress > 0 ? "text-green-500" : "text-foreground/30"}`}>
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
