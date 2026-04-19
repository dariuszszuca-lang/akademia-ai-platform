import Link from "next/link";
import type { Course } from "@/data/modules";
import { getEffectiveResources } from "@/lib/module-overrides";

export const dynamic = "force-dynamic";

const sections: { title: string; description: string; categories: Course["category"][] }[] = [
  {
    title: "Skarbiec i replaye",
    description: "Playbooki, checklisty, szablony i archiwum Q&A.",
    categories: ["Skarbiec"],
  },
  {
    title: "Narzędzia",
    description: "Claude, Gemini, NotebookLM, Lovable, Claude Code — z przykładami użycia.",
    categories: ["Narzędzia"],
  },
  {
    title: "Wejścia zewnętrzne",
    description: "Narzędzia poza platformą.",
    categories: ["Zewnętrzne"],
  },
];

export default async function SkarbiecPage() {
  const all = await getEffectiveResources();
  const items = all.filter((r) => r.enabled);

  return (
    <div className="mx-auto max-w-4xl space-y-10 animate-fade-in-up">
      <header>
        <p className="eyebrow">Skarbiec</p>
        <h1 className="display-title mt-3 text-4xl text-foreground sm:text-5xl">
          Wszystko, do czego wracasz.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-foreground/60">
          Miejsce na playbooki, narzędzia, replaye i wejścia zewnętrzne.
        </p>
      </header>

      {sections.map((section) => {
        const sectionItems = items.filter((r) => section.categories.includes(r.category));
        if (!sectionItems.length) return null;

        return (
          <section key={section.title}>
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
              {section.title}
            </h2>
            <p className="mt-1 text-sm text-foreground/55">{section.description}</p>
            <div className="mt-4 space-y-2">
              {sectionItems.map((resource) => (
                <ResourceRow key={resource.id} resource={resource} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ResourceRow({ resource }: { resource: Course }) {
  const body = (
    <div className="group flex items-start gap-4 rounded-2xl border border-border bg-background/55 px-5 py-4 transition hover:border-foreground/40">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold"
        style={{ background: `${resource.accentColor}18`, color: resource.accentColor }}
      >
        {resource.icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-foreground">{resource.title}</h3>
        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-foreground/55">
          {resource.description}
        </p>
      </div>
      <span className="shrink-0 self-center text-xs font-semibold uppercase tracking-[0.14em] text-foreground/40">
        {resource.external ? "Otwórz ↗" : "Wejdź →"}
      </span>
    </div>
  );

  if (resource.external) {
    return (
      <a href={resource.external} target="_blank" rel="noopener noreferrer">
        {body}
      </a>
    );
  }
  return <Link href={`/classroom/${resource.id}`}>{body}</Link>;
}
