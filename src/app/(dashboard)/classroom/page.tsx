import Image from "next/image";
import Link from "next/link";
import { modules, type Course } from "@/data/modules";
import { getEffectiveModules } from "@/lib/module-overrides";

export const dynamic = "force-dynamic";

const collections = [
  {
    title: "Start",
    description: "Wejście do platformy i przygotowanie przed warsztatami stacjonarnymi.",
    categories: ["Start"] as Course["category"][],
  },
  {
    title: "Warsztaty",
    description: "Cztery dni pracy: spotkanie online, dwa dni stacjonarne, sesja Q&A online.",
    categories: ["Warsztaty"] as Course["category"][],
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

        {course.meta && (
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--muted-gold)]">
            {course.meta}
          </p>
        )}

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
          <span className="text-xs text-foreground/35">
            {course.lessons > 0 ? `${course.lessons} lekcji` : "Wejście zewnętrzne"}
          </span>
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

export default async function ClassroomPage() {
  const all = await getEffectiveModules();
  const visible = all.filter((m) => m.enabled);
  const featured = visible.find((m) => m.id === "przygotowanie") ?? visible[0];
  const hiddenCount = modules.length - visible.length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <section className="premium-grid">
        <div className="section-shell rounded-[2rem] p-8 sm:p-10">
          <div className="relative z-10 max-w-2xl">
            <p className="eyebrow">Warsztaty</p>
            <h1 className="display-title mt-4 text-5xl text-foreground sm:text-6xl">
              Cztery dni pracy nad Twoim AI.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-foreground/66 sm:text-lg">
              Spotkanie online, dwa dni warsztatów stacjonarnych i sesja Q&A. Każdy moduł otwiera się w odpowiednim momencie.
            </p>
          </div>
        </div>

        {featured && (
          <aside className="section-shell rounded-[2rem] p-6 sm:p-7">
            <div className="relative z-10 space-y-4">
              <div>
                <p className="eyebrow">Aktualny moduł</p>
                <h2 className="mt-3 font-display text-3xl text-foreground">{featured.title}.</h2>
              </div>
              <div className="rounded-[1.5rem] border border-border bg-background/55 p-5">
                <p className="text-sm font-semibold text-foreground">
                  {featured.lessons > 0 ? `${featured.lessons} lekcji` : "Otwierane przez prowadzącego"}
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground/58">{featured.description}</p>
              </div>
            </div>
          </aside>
        )}
      </section>

      {featured && (
        <section className="section-shell rounded-[2rem] p-6 sm:p-8">
          <div className="relative z-10">
            <p className="eyebrow">Polecane wejście</p>
            <div className="mt-4">
              <CourseCard course={featured} featured />
            </div>
          </div>
        </section>
      )}

      {collections.map((collection) => {
        const items = visible.filter((course) => collection.categories.includes(course.category));
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

      {hiddenCount > 0 && (
        <section className="section-shell rounded-[2rem] border border-dashed border-border bg-background/35 p-6 sm:p-8">
          <div className="relative z-10">
            <p className="eyebrow">Wkrótce</p>
            <h2 className="mt-3 font-display text-2xl text-foreground/70">
              Kolejne moduły zostaną otwarte w odpowiednim momencie.
            </h2>
            <p className="mt-3 text-sm leading-6 text-foreground/50">
              Prowadzący odblokowuje moduły podczas warsztatów. Zostaniesz powiadomiony, kiedy pojawią się kolejne.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
