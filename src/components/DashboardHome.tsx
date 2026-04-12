"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const currentCourse = {
  id: "dzien-1",
  title: "DZIEŃ 1: Twój AI Team w Akcji",
  lastLesson: "Weryfikacja + Konfiguracja projektu",
  progress: 0,
  completedLessons: 0,
  totalLessons: 7,
  accentColor: "#6366f1",
};

const nextEvent = {
  date: "15 KWI",
  day: "Środa",
  title: "Spotkanie online — przygotowanie",
  time: "9:00",
  type: "online" as const,
};

const latestPosts = [
  { id: 1, author: "Dariusz Szuca", title: "Witamy w Akademii AI — Edycja #1 startuje 15 kwietnia!", time: "1d" },
  { id: 2, author: "Dariusz Szuca", title: "Przygotowanie do warsztatu — co zrobić przed 15 kwietnia", time: "2d" },
];

const quickStats = [
  {
    label: "Ukończone lekcje",
    value: "0",
    total: "/7",
    accentColor: "#6366f1",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
      </svg>
    ),
  },
  {
    label: "Zadania wykonane",
    value: "0",
    total: "/6",
    accentColor: "#10b981",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    label: "Edycja",
    value: "#1",
    total: "",
    accentColor: "#C9A030",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
      </svg>
    ),
  },
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
      <div className="space-y-4 stagger-children">
        {/* Row 1: Continue learning — colorful card */}
        <Link href={`/classroom/${currentCourse.id}`} className="block group">
          <div className="relative overflow-hidden bg-card border border-border rounded-2xl card-hover">
            {/* Colored top accent bar */}
            <div
              className="h-1.5 w-full"
              style={{ background: `linear-gradient(90deg, ${currentCourse.accentColor}, ${currentCourse.accentColor}99)` }}
            />

            {/* Subtle radial glow */}
            <div
              className="absolute top-0 right-0 w-56 h-56 opacity-[0.05]"
              style={{ background: `radial-gradient(circle, ${currentCourse.accentColor} 0%, transparent 70%)` }}
            />

            <div className="p-6 sm:p-8">
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
                        stroke={currentCourse.accentColor} strokeWidth="4"
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
                <div className="flex-1 h-2 bg-slate-light rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(currentCourse.progress, 2)}%`,
                      background: currentCourse.progress > 0
                        ? `linear-gradient(90deg, ${currentCourse.accentColor}, ${currentCourse.accentColor}cc)`
                        : "var(--border)",
                    }}
                  />
                </div>
                <span className="text-[11px] text-foreground/30 tabular-nums flex-shrink-0">
                  {currentCourse.completedLessons}/{currentCourse.totalLessons} lekcji
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* Row 2: Quick stat cards (3 columns) */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {quickStats.map((stat, i) => (
            <div
              key={i}
              className="relative overflow-hidden bg-card border border-border rounded-2xl p-4 sm:p-5"
            >
              {/* Top accent */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: stat.accentColor }}
              />
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${stat.accentColor}12`, color: stat.accentColor }}
              >
                {stat.icon}
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground tabular-nums leading-none">
                {stat.value}
                {stat.total && (
                  <span className="text-foreground/20 font-normal text-sm">{stat.total}</span>
                )}
              </div>
              <p className="text-[11px] text-foreground/35 mt-1.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Row 3: Event + Community (two columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Next event */}
          <Link href="/calendar" className="block group">
            <div className="relative overflow-hidden bg-card border border-border rounded-2xl card-hover h-full">
              <div
                className="h-1.5 w-full"
                style={{ background: nextEvent.type === "online" ? "#60a5fa" : "#C9A030" }}
              />
              <div className="p-6">
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
                    className="text-[9px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
                    style={{
                      background: nextEvent.type === "online" ? "rgba(59, 130, 246, 0.08)" : "rgba(201, 160, 48, 0.08)",
                      color: nextEvent.type === "online" ? "#60a5fa" : "#C9A030",
                    }}
                  >
                    {nextEvent.type === "online" ? "Online" : "Stacjonarnie"}
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* Community posts */}
          <Link href="/community" className="block group">
            <div className="relative overflow-hidden bg-card border border-border rounded-2xl card-hover h-full">
              <div className="h-1.5 w-full" style={{ background: "#C9A030" }} />
              <div className="p-6">
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
                        className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-semibold"
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
            </div>
          </Link>
        </div>

        {/* Row 4: Quick links */}
        <div className="relative overflow-hidden bg-card border border-border rounded-2xl">
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #C9A030, #6366f1, #10b981)" }} />
          <div className="p-6">
            <span className="text-[10px] text-gold/60 uppercase tracking-[0.2em] font-semibold">
              Szybkie linki
            </span>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Link
                href="/classroom"
                className="flex items-center gap-3 px-4 py-3 bg-slate-light rounded-xl hover:bg-gold/5 transition-colors group/link"
              >
                <svg className="w-4 h-4 text-foreground/30 group-hover/link:text-gold transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
                <span className="text-xs font-medium text-foreground/60 group-hover/link:text-foreground transition-colors">Materiały</span>
              </Link>
              <Link
                href="/classroom/biblioteka"
                className="flex items-center gap-3 px-4 py-3 bg-slate-light rounded-xl hover:bg-gold/5 transition-colors group/link"
              >
                <svg className="w-4 h-4 text-foreground/30 group-hover/link:text-gold transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                <span className="text-xs font-medium text-foreground/60 group-hover/link:text-foreground transition-colors">Biblioteka zasobów</span>
              </Link>
              <Link
                href="/classroom/narzedzia"
                className="flex items-center gap-3 px-4 py-3 bg-slate-light rounded-xl hover:bg-gold/5 transition-colors group/link"
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
