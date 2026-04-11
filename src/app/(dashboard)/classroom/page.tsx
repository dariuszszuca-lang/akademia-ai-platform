"use client";

import { useState } from "react";
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
  const [isOpen, setIsOpen] = useState(false);

  const isClickable = !course.locked;

  return (
    <div
      className={`bg-card border border-border overflow-hidden transition-all duration-300 ${
        course.locked ? "opacity-40" : "card-hover"
      }`}
      style={{ borderLeft: `3px solid ${course.accentColor}` }}
    >
      {/* Header — always visible, clickable to expand */}
      <button
        onClick={() => isClickable && setIsOpen(!isOpen)}
        className={`w-full text-left p-5 flex items-center gap-4 ${
          isClickable ? "cursor-pointer hover:bg-slate-light/30" : "cursor-not-allowed"
        } transition-colors`}
      >
        {/* Number */}
        <div
          className="w-10 h-10 flex items-center justify-center flex-shrink-0"
          style={{ background: `${course.accentColor}12` }}
        >
          <span className="font-heading text-sm font-bold" style={{ color: course.accentColor, opacity: 0.7 }}>
            {course.icon}
          </span>
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-xs font-semibold text-foreground uppercase tracking-[0.1em] truncate">
            {course.title}
          </h3>
          {!course.locked && course.lessons > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-foreground/25">{course.lessons} lekcji</span>
              <div className="w-16 h-1 bg-slate-light overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(course.progress, 3)}%`,
                    background: course.progress > 0 ? course.accentColor : "var(--border)",
                  }}
                />
              </div>
              <span className="text-[10px] text-foreground/20">{course.progress}%</span>
            </div>
          )}
        </div>

        {/* Expand/lock icon */}
        <div className="flex-shrink-0">
          {course.locked ? (
            <svg className="w-4 h-4 text-foreground/20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          ) : (
            <svg
              className={`w-4 h-4 text-foreground/25 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && !course.locked && (
        <div className="px-5 pb-5 animate-fade-in">
          <div className="border-t border-border pt-4">
            <p className="text-sm text-foreground/50 leading-relaxed mb-4">
              {course.description}
            </p>

            {course.external ? (
              <a
                href={course.external}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors"
                style={{
                  background: `${course.accentColor}10`,
                  color: course.accentColor,
                }}
              >
                Otwórz stronę
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            ) : (
              <Link
                href={`/classroom/${course.id}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors"
                style={{
                  background: `${course.accentColor}10`,
                  color: course.accentColor,
                }}
              >
                Wejdź do kursu
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
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
          Kliknij na kurs aby zobaczyć szczegóły
        </p>
        <div className="w-24 h-px bg-gradient-to-r from-gold to-transparent mt-4" />
      </div>

      <div className="space-y-2 max-w-3xl stagger-children">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </div>
  );
}
