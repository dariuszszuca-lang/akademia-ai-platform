"use client";

import Link from "next/link";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Lesson } from "@/data/modules";
import type { SidebarModule } from "./page";

type Props = {
  sidebar: SidebarModule[];
  currentCourseId: string;
  currentLessonId: string;
  course: {
    id: string;
    title: string;
    description: string;
    accentColor: string;
    category: string;
  };
  lesson: Lesson;
};

const typeLabel: Record<Lesson["type"], string> = {
  tekst: "Tekst",
  video: "Video",
  zadanie: "Zadanie",
};

export default function CourseLayout({
  sidebar,
  currentCourseId,
  currentLessonId,
  course,
  lesson,
}: Props) {
  const currentLessonIndex =
    sidebar
      .find((m) => m.id === currentCourseId)
      ?.lessons.findIndex((l) => l.id === currentLessonId) ?? 0;
  const totalLessons =
    sidebar.find((m) => m.id === currentCourseId)?.lessons.length ?? 0;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col lg:grid lg:grid-cols-[300px_1fr] lg:gap-8">
      <Sidebar
        modules={sidebar}
        currentCourseId={currentCourseId}
        currentLessonId={currentLessonId}
      />

      <main className="min-w-0 py-2">
        <div className="mb-4 flex items-center justify-between gap-3 text-xs text-foreground/50">
          <Link href="/classroom" className="hover:text-foreground">
            ← Wszystkie warsztaty
          </Link>
          <span>
            Lekcja {currentLessonIndex + 1} z {totalLessons}
          </span>
        </div>

        <div className="rounded-[2rem] border border-border bg-[color:var(--card)] p-6 sm:p-10 shadow-[var(--shadow-soft)]">
          <header className="mb-6 border-b border-border pb-6">
            <p
              className="eyebrow"
              style={{ color: course.accentColor }}
            >
              {course.title}
            </p>
            <h1 className="mt-3 font-display text-3xl text-foreground sm:text-4xl">
              {lesson.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-foreground/50">
              <span
                className="rounded-full border border-border px-3 py-1 font-semibold uppercase tracking-[0.14em]"
                style={{ color: course.accentColor }}
              >
                {typeLabel[lesson.type]}
              </span>
              {lesson.duration && (
                <span>{lesson.duration} min</span>
              )}
            </div>
          </header>

          <article className="prose prose-neutral max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {lesson.content}
            </ReactMarkdown>
          </article>

          {lesson.files && lesson.files.length > 0 && (
            <section className="mt-10 border-t border-border pt-6">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/60">
                Materiały do lekcji
              </h2>
              <div className="space-y-2">
                {lesson.files.map((file) => (
                  <a
                    key={file.url}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/55 px-5 py-3 text-sm transition hover:border-foreground/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--muted-gold)]/10 text-[color:var(--muted-gold)]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </span>
                      <span className="truncate text-foreground">{file.name}</span>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/40">
                      Pobierz →
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          <nav className="mt-10 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <PrevNext
              sidebar={sidebar}
              currentCourseId={currentCourseId}
              currentLessonId={currentLessonId}
            />
          </nav>
        </div>
      </main>
    </div>
  );
}

function Sidebar({
  modules,
  currentCourseId,
  currentLessonId,
}: {
  modules: SidebarModule[];
  currentCourseId: string;
  currentLessonId: string;
}) {
  const [openId, setOpenId] = useState<string>(currentCourseId);

  return (
    <aside className="lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto">
      <div className="rounded-[2rem] border border-border bg-[color:var(--card)] p-4">
        <p className="mb-3 px-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
          Moduły
        </p>
        <div className="space-y-1">
          {modules.map((m) => {
            const isOpen = openId === m.id;
            const isCurrent = m.id === currentCourseId;

            return (
              <div key={m.id}>
                <button
                  onClick={() => setOpenId(isOpen ? "" : m.id)}
                  disabled={!m.enabled}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    isCurrent
                      ? "bg-foreground/5 text-foreground"
                      : "text-foreground/70 hover:bg-foreground/5"
                  } ${!m.enabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[0.7rem] font-extrabold"
                    style={{
                      background: `${m.accentColor}18`,
                      color: m.accentColor,
                    }}
                  >
                    {m.enabled ? m.icon : "🔒"}
                  </span>
                  <span className="flex-1 truncate font-medium">{m.title}</span>
                  {m.enabled && m.lessons.length > 0 && (
                    <svg
                      className={`h-3 w-3 shrink-0 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      viewBox="0 0 12 12"
                      fill="currentColor"
                    >
                      <path d="M6 8L1 3h10l-5 5z" />
                    </svg>
                  )}
                </button>

                {isOpen && m.enabled && (
                  <div className="ml-10 mt-1 space-y-0.5 pb-2">
                    {m.lessons.map((l, idx) => {
                      const isActive =
                        m.id === currentCourseId && l.id === currentLessonId;
                      return (
                        <Link
                          key={l.id}
                          href={`/classroom/${m.id}?lesson=${l.id}`}
                          className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition ${
                            isActive
                              ? "bg-foreground text-background"
                              : "text-foreground/55 hover:bg-foreground/5 hover:text-foreground"
                          }`}
                        >
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[0.6rem] font-bold">
                            {idx + 1}
                          </span>
                          <span className="flex-1 leading-snug">{l.title}</span>
                          {l.duration && (
                            <span className="shrink-0 text-[0.62rem] opacity-60">
                              {l.duration}′
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function PrevNext({
  sidebar,
  currentCourseId,
  currentLessonId,
}: {
  sidebar: SidebarModule[];
  currentCourseId: string;
  currentLessonId: string;
}) {
  const flat: { moduleId: string; lessonId: string; title: string }[] = [];
  for (const m of sidebar) {
    if (!m.enabled) continue;
    for (const l of m.lessons) {
      flat.push({ moduleId: m.id, lessonId: l.id, title: l.title });
    }
  }
  const idx = flat.findIndex(
    (e) => e.moduleId === currentCourseId && e.lessonId === currentLessonId,
  );
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  return (
    <>
      <div className="flex-1">
        {prev && (
          <Link
            href={`/classroom/${prev.moduleId}?lesson=${prev.lessonId}`}
            className="group flex items-start gap-3 rounded-xl border border-border bg-background/55 px-4 py-3 text-sm transition hover:border-foreground/40"
          >
            <span className="mt-0.5 text-foreground/40">←</span>
            <span className="min-w-0">
              <span className="block text-[0.62rem] uppercase tracking-[0.18em] text-foreground/40">
                Poprzednia
              </span>
              <span className="mt-0.5 block truncate font-semibold text-foreground/80 group-hover:text-foreground">
                {prev.title}
              </span>
            </span>
          </Link>
        )}
      </div>
      <div className="flex-1 sm:text-right">
        {next && (
          <Link
            href={`/classroom/${next.moduleId}?lesson=${next.lessonId}`}
            className="group inline-flex items-start gap-3 rounded-xl bg-foreground px-4 py-3 text-sm text-background transition hover:opacity-90"
          >
            <span className="min-w-0 text-left">
              <span className="block text-[0.62rem] uppercase tracking-[0.18em] opacity-60">
                Następna
              </span>
              <span className="mt-0.5 block truncate font-semibold">
                {next.title}
              </span>
            </span>
            <span className="mt-0.5 opacity-60">→</span>
          </Link>
        )}
      </div>
    </>
  );
}
