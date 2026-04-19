import { notFound, redirect } from "next/navigation";
import { type Lesson, type Course } from "@/data/modules";
import { getEffectiveModules } from "@/lib/module-overrides";
import CourseLayout from "./CourseLayout";

export const dynamic = "force-dynamic";

type Props = {
  params: { courseId: string };
  searchParams: { lesson?: string };
};

export default async function CoursePage({ params, searchParams }: Props) {
  const effective = await getEffectiveModules();

  const current = effective.find((m) => m.id === params.courseId);
  if (!current) notFound();

  if (!current.enabled) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="eyebrow">Wkrótce</p>
        <h1 className="mt-4 font-display text-3xl text-foreground">
          {current.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-foreground/60">
          Ten moduł zostanie odblokowany przez prowadzącego w odpowiednim momencie warsztatów.
        </p>
      </div>
    );
  }

  const lessons: Lesson[] = current.items ?? [];
  if (lessons.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="eyebrow">{current.title}</p>
        <p className="mt-4 text-sm text-foreground/60">
          Lekcje dla tego modułu pojawią się wkrótce.
        </p>
      </div>
    );
  }

  const requestedLesson = searchParams.lesson;
  const activeLesson =
    lessons.find((l) => l.id === requestedLesson) ?? lessons[0];

  if (!requestedLesson) {
    redirect(`/classroom/${current.id}?lesson=${activeLesson.id}`);
  }

  // Build sidebar data: all modules with their lessons, categorized
  const sidebar = effective
    .filter((m) => m.category === "Start" || m.category === "Warsztaty")
    .map<SidebarModule>((m) => ({
      id: m.id,
      title: m.title,
      icon: m.icon,
      accentColor: m.accentColor,
      enabled: m.enabled,
      meta: m.meta,
      category: m.category === "Warsztaty" ? "Warsztaty" : "Start",
      lessons: (m.items ?? []).map((l) => ({
        id: l.id,
        title: l.title,
        type: l.type,
        duration: l.duration,
      })),
    }));

  return (
    <CourseLayout
      sidebar={sidebar}
      currentCourseId={current.id}
      currentLessonId={activeLesson.id}
      course={serializeCourse(current)}
      lesson={activeLesson}
    />
  );
}

function serializeCourse(c: Course) {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    accentColor: c.accentColor,
    category: c.category,
  };
}

export type SidebarModule = {
  id: string;
  title: string;
  icon: string;
  accentColor: string;
  enabled: boolean;
  meta?: string;
  category: "Start" | "Warsztaty";
  lessons: SidebarLesson[];
};

export type SidebarLesson = {
  id: string;
  title: string;
  type: Lesson["type"];
  duration?: number;
};

