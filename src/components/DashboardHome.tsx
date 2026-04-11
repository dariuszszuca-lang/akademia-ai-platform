"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const currentCourse = {
  id: "edycja-1",
  title: "AKADEMIA AI — EDYCJA I",
  lastLesson: "Proces: AI-First Mindset",
  progress: 12,
  completedLessons: 4,
  totalLessons: 30,
};

const nextEvent = {
  date: "15 KWI",
  day: "Środa",
  title: "Online wstępne",
  time: "9:00",
  type: "online" as const,
};

const latestPosts = [
  { id: 1, author: "Dariusz Szuca", title: "Witamy w Akademii AI!", time: "1d" },
  { id: 2, author: "Dariusz Szuca", title: "Jak zacząć korzystać z Claude w nieruchomościach", time: "2d" },
];

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="animate-fade-in">
      {/* Greeting */}
      <div className="mb-8">
        <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground tracking-wide gold-glow-text">
          Witaj, {user?.name.split(" ")[0]}
        </h2>
        <p className="text-sm text-foreground/35 mt-2 font-light tracking-wide">
          Twoje centrum nauki AI
        </p>
        <div className="w-24 h-px bg-gradient-to-r from-gold to-transparent mt-4" />
      </div>

      {/* Bento layout */}
      <div className="space-y-4">
        {/* Row 1: Continue learning (big) */}
        <Link href={`/classroom/${currentCourse.id}`} className="block group">
          <div
            className="relative overflow-hidden bg-card border border-border p-6 sm:p-8 card-hover"
            style={{ borderLeft: "4px solid #6366f1" }}
          >
            <div className="absolute top-0 right-0 w-48 h-48 opacity-[0.03]"
              style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }}
            />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-gold/60 uppercase tracking-[0.2em] font-semibold">
                  Kontynuuj naukę
                </span>
                <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground mt-2 group-hover:text-gold transition-colors leading-tight">
                  {currentCourse.title}
                </h3>
                <p className="text-sm text-foreground/40 mt-2 font-light">
                  Ostatnia lekcja: {currentCourse.lastLesson}
                </p>
              </div>
              <div className="flex items-center gap-5 flex-shrink-0">
                {/* Circular progress */}
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="var(--border)" strokeWidth="4" />
                    <circle
                      cx="32" cy="32" r="28" fill="none"
                      stroke="#6366f1" strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - currentCourse.progress / 100)}`}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground tabular-nums">
                    {currentCourse.progress}%
                  </span>
                </div>
                <svg className="w-5 h-5 text-foreground/15 group-hover:text-gold group-hover:translate-x-1 transition-all hidden sm:block" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-5 flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-slate-light overflow-hidden" style={{ borderRadius: "0" }}>
                <div
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${currentCourse.progress}%`,
                    background: "linear-gradient(90deg, #6366f1, #7c3aed)",
                  }}
                />
              </div>
              <span className="text-[11px] text-foreground/30 tabular-nums flex-shrink-0">
                {currentCourse.completedLessons}/{currentCourse.totalLessons} lekcji
              </span>
            </div>
          </div>
        </Link>

        {/* Row 2: Event + Progress (two columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Next event */}
          <Link href="/calendar" className="block group">
            <div
              className="bg-card border border-border p-6 card-hover h-full"
              style={{ borderLeft: `3px solid ${nextEvent.type === "online" ? "#60a5fa" : "#C9A030"}` }}
            >
              <span className="text-[10px] text-gold/60 uppercase tracking-[0.2em] font-semibold">
                Najbliższe spotkanie
              </span>
              <div className="flex items-center gap-4 mt-4">
                <div className="text-center flex-shrink-0">
                  <span className="text-2xl font-bold text-foreground tabular-nums block leading-none">15</span>
                  <span className="text-[10px] text-foreground/30 uppercase tracking-wider">KWI</span>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm group-hover:text-gold transition-colors truncate">
                    {nextEvent.title}
                  </p>
                  <p className="text-xs text-foreground/30 mt-1">{nextEvent.day}, {nextEvent.time}</p>
                </div>
              </div>
              <div className="mt-4">
                <span
                  className="text-[9px] font-semibold uppercase tracking-wider px-2 py-1"
                  style={{
                    background: nextEvent.type === "online" ? "rgba(59, 130, 246, 0.06)" : "rgba(201, 160, 48, 0.08)",
                    color: nextEvent.type === "online" ? "#60a5fa" : "#C9A030",
                  }}
                >
                  {nextEvent.type === "online" ? "Online" : "Stacjonarnie"}
                </span>
              </div>
            </div>
          </Link>

          {/* Your progress */}
          <div className="bg-card border border-border p-6" style={{ borderLeft: "3px solid #10b981" }}>
            <span className="text-[10px] text-gold/60 uppercase tracking-[0.2em] font-semibold">
              Twój postęp
            </span>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/50">Ukończone lekcje</span>
                <span className="text-lg font-bold text-foreground tabular-nums">
                  {currentCourse.completedLessons}<span className="text-foreground/20 font-normal">/{currentCourse.totalLessons}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/50">Zadania wykonane</span>
                <span className="text-lg font-bold text-foreground tabular-nums">
                  1<span className="text-foreground/20 font-normal">/12</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/50">Edycja</span>
                <span className="text-sm font-semibold text-gold">#1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Community + Quick links (two columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          {/* Community posts (3/5) */}
          <Link href="/community" className="block group sm:col-span-3">
            <div className="bg-card border border-border p-6 card-hover h-full">
              <span className="text-[10px] text-gold/60 uppercase tracking-[0.2em] font-semibold">
                Nowe w społeczności
              </span>
              <div className="mt-4 space-y-0">
                {latestPosts.map((post, i) => (
                  <div
                    key={post.id}
                    className={`flex items-center gap-3 py-3 ${
                      i < latestPosts.length - 1 ? "border-b border-border/50" : ""
                    }`}
                  >
                    <div
                      className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-xs font-semibold"
                      style={{ background: "rgba(201, 160, 48, 0.12)", color: "#C9A030" }}
                    >
                      {post.author.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-gold transition-colors">
                        {post.title}
                      </p>
                      <p className="text-[11px] text-foreground/25 mt-0.5">
                        {post.author} &middot; {post.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Link>

          {/* Quick links (2/5) */}
          <div className="sm:col-span-2 bg-card border border-border p-6">
            <span className="text-[10px] text-gold/60 uppercase tracking-[0.2em] font-semibold">
              Szybkie linki
            </span>
            <div className="mt-4 space-y-2">
              <Link
                href="/classroom"
                className="flex items-center gap-3 px-3 py-2.5 bg-slate-light hover:bg-gold/5 transition-colors group/link"
              >
                <svg className="w-4 h-4 text-foreground/30 group-hover/link:text-gold transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
                <span className="text-xs font-medium text-foreground/60 group-hover/link:text-foreground transition-colors">Materiały</span>
              </Link>
              <Link
                href="/classroom/biblioteka"
                className="flex items-center gap-3 px-3 py-2.5 bg-slate-light hover:bg-gold/5 transition-colors group/link"
              >
                <svg className="w-4 h-4 text-foreground/30 group-hover/link:text-gold transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                <span className="text-xs font-medium text-foreground/60 group-hover/link:text-foreground transition-colors">Biblioteka zasobów</span>
              </Link>
              <Link
                href="/classroom/narzedzia"
                className="flex items-center gap-3 px-3 py-2.5 bg-slate-light hover:bg-gold/5 transition-colors group/link"
              >
                <svg className="w-4 h-4 text-foreground/30 group-hover/link:text-gold transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384 5.384a1.667 1.667 0 01-2.357-2.357L9.05 12.813m2.37 2.357l5.384-5.384a1.667 1.667 0 012.357 2.357l-5.384 5.384m-2.357-2.357l2.357-2.357" />
                </svg>
                <span className="text-xs font-medium text-foreground/60 group-hover/link:text-foreground transition-colors">Narzędzia AI</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
