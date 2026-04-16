"use client";

import Image from "next/image";
import Link from "next/link";

type Course = {
  id: string;
  title: string;
  description: string;
  progress: number;
  accentColor: string;
  icon: string;
  lessons: number;
  category: "Start" | "Program główny" | "Skarbiec" | "Narzędzia" | "Zewnętrzne";
  locked?: boolean;
  external?: string;
  image?: string;
};

const courses: Course[] = [
  {
    id: "start",
    title: "Start tutaj",
    description: "Powitanie, orientacja i pierwszy rytm pracy wewnątrz platformy.",
    progress: 0,
    accentColor: "#576150",
    icon: "01",
    lessons: 3,
    category: "Start",
  },
  {
    id: "przygotowanie",
    title: "Przygotowanie przed warsztatem",
    description: "Profil przedsiębiorcy, persony, oferta, konfiguracja kont AI i pobranie asystentów.",
    progress: 0,
    accentColor: "#b28a52",
    icon: "02",
    lessons: 6,
    category: "Program główny",
  },
  {
    id: "dzien-1",
    title: "Dzień 1: Twój AI Team w akcji",
    description: "Konfiguracja, styl pisania, wideo, posty, narzędzia agenta i plan działania.",
    progress: 0,
    accentColor: "#1e4e53",
    icon: "03",
    lessons: 7,
    category: "Program główny",
  },
  {
    id: "dzien-2",
    title: "Dzień 2: Automatyzacja i zaawansowane workflowy",
    description: "Instalacja lokalna, skille, API, MCP, automatyzacje, integracje i certyfikacja.",
    progress: 0,
    accentColor: "#b96d5d",
    icon: "04",
    lessons: 7,
    category: "Program główny",
  },
  {
    id: "nagrania-qa",
    title: "Nagrania Q&A",
    description: "Archiwum sesji Q&A z sobót i odpowiedzi na pytania pojawiające się po warsztatach.",
    progress: 0,
    accentColor: "#7c5d99",
    icon: "05",
    lessons: 1,
    category: "Skarbiec",
  },
  {
    id: "rct",
    title: "Rejestr cen transakcyjnych",
    description: "Darmowy dostęp do rzeczywistych cen nieruchomości z aktów notarialnych.",
    progress: 0,
    accentColor: "#8d6170",
    icon: "06",
    lessons: 0,
    external: "https://rejestrcentransakcyjnych.pl",
    category: "Zewnętrzne",
  },
  {
    id: "biblioteka",
    title: "Skarbiec zasobów",
    description: "Prompty, checklisty, poradniki, szablony i playbooki do wykorzystania w pracy.",
    progress: 0,
    accentColor: "#3b7d78",
    icon: "07",
    lessons: 11,
    category: "Skarbiec",
  },
  {
    id: "narzedzia",
    title: "Narzędzia AI",
    description: "Claude, Gemini, NotebookLM, Lovable i Claude Code z przykładami użycia.",
    progress: 0,
    accentColor: "#5d7a62",
    icon: "08",
    lessons: 5,
    category: "Narzędzia",
  },
];

const collections = [
  {
    title: "Program główny",
    description: "Rdzeń transformacji: przygotowanie, dwa dni warsztatowe i przejście do praktyki.",
    categories: ["Start", "Program główny"] as Course["category"][],
  },
  {
    title: "Skarbiec i replaye",
    description: "Materiały, do których wracasz po live'ach, kiedy chcesz utrwalić albo odtworzyć proces.",
    categories: ["Skarbiec", "Narzędzia"] as Course["category"][],
  },
  {
    title: "Wejścia zewnętrzne",
    description: "Dodatkowe narzędzia i zasoby, które rozszerzają pracę poza samą platformą.",
    categories: ["Zewnętrzne"] as Course["category"][],
  },
];

function CourseCard({ course, featured = false }: { course: Course; featured?: boolean }) {
  const cardClassName = `group relative overflow-hidden rounded-[1.75rem] border border-border ${
    featured
      ? "bg-[linear-gradient(180deg,rgba(30,78,83,0.08),rgba(255,252,247,0.52))]"
      : "bg-background/55"
  } p-6`;

  const content = (
    <div className={`${cardClassName} ${course.locked ? "opacity-40 grayscale" : "card-hover cursor-pointer"}`}>
      {course.image ? (
        <div className="relative mb-5 h-36 overflow-hidden rounded-[1.3rem]">
          <Image src={course.image} alt={course.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
        </div>
      ) : (
        <div
          className="absolute right-0 top-0 h-40 w-40 opacity-[0.08]"
          style={{ background: `radial-gradient(circle, ${course.accentColor} 0%, transparent 70%)` }}
        />
      )}

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-[1rem] text-sm font-extrabold"
            style={{ background: `${course.accentColor}18`, color: course.accentColor }}
          >
            {course.icon}
          </div>
          <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-foreground/42">
            {course.category}
          </span>
        </div>

        <h3 className="mt-5 text-xl font-semibold text-foreground transition-colors group-hover:text-accent">
          {course.title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-foreground/58">{course.description}</p>

        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-light">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(course.progress, 3)}%`,
                  background: course.progress > 0 ? `linear-gradient(90deg, ${course.accentColor}, ${course.accentColor}cc)` : "var(--border)",
                }}
              />
            </div>
            <span className="text-xs text-foreground/42">{course.progress}%</span>
          </div>
          <span className="text-xs text-foreground/35">{course.lessons > 0 ? `${course.lessons} lekcji` : "Wejście zewnętrzne"}</span>
        </div>
      </div>
    </div>
  );

  if (course.external) {
    return (
      <a href={course.external} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return <Link href={`/programy/${course.id}`}>{content}</Link>;
}

export default function ClassroomPage() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <section className="premium-grid">
        <div className="section-shell rounded-[2rem] p-8 sm:p-10">
          <div className="relative z-10 max-w-2xl">
            <p className="eyebrow">Programy</p>
            <h1 className="display-title mt-4 text-5xl text-foreground sm:text-6xl">
              Ścieżki pracy i wdrożeń.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-foreground/66 sm:text-lg">
              Każdy program ma prowadzić do konkretnego rezultatu: od przygotowania, przez warsztaty,
              po skarbiec materiałów i narzędzi do codziennej pracy.
            </p>
          </div>
        </div>

        <aside className="section-shell rounded-[2rem] p-6 sm:p-7">
          <div className="relative z-10 space-y-4">
            <div>
              <p className="eyebrow">Aktualna ścieżka</p>
              <h2 className="mt-3 font-display text-3xl text-foreground">Przygotowanie przed warsztatem.</h2>
            </div>
            <div className="rounded-[1.5rem] border border-border bg-background/55 p-5">
              <p className="text-sm font-semibold text-foreground">6 zadań do zamknięcia</p>
              <p className="mt-2 text-sm leading-6 text-foreground/58">
                Profil przedsiębiorcy, persony, oferta, konfiguracja kont i pobranie asystentów.
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section className="section-shell rounded-[2rem] p-6 sm:p-8">
        <div className="relative z-10">
          <p className="eyebrow">Polecane wejście</p>
          <div className="mt-4">
            <CourseCard course={courses[1]} featured />
          </div>
        </div>
      </section>

      {collections.map((collection) => {
        const items = courses.filter((course) => collection.categories.includes(course.category));

        if (!items.length) return null;

        return (
          <section key={collection.title} className="section-shell rounded-[2rem] p-6 sm:p-8">
            <div className="relative z-10">
              <div className="mb-6">
                <p className="eyebrow">{collection.title}</p>
                <h2 className="mt-3 font-display text-3xl text-foreground">{collection.description}</h2>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {items.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
