import Image from "next/image";
import Link from "next/link";
import type { Course } from "@/data/modules";
import { getEffectiveResources } from "@/lib/module-overrides";

export const dynamic = "force-dynamic";

const collections = [
  {
    title: "Skarbiec i replaye",
    description: "Prompty, checklisty, poradniki, szablony, playbooki oraz archiwum Q&A.",
    categories: ["Skarbiec"] as Course["category"][],
  },
  {
    title: "Narzędzia",
    description: "Claude, Gemini, NotebookLM, Lovable i Claude Code — z przykładami użycia.",
    categories: ["Narzędzia"] as Course["category"][],
  },
  {
    title: "Wejścia zewnętrzne",
    description: "Dodatkowe narzędzia i zasoby, które rozszerzają pracę poza platformą.",
    categories: ["Zewnętrzne"] as Course["category"][],
  },
];

function ResourceCard({ resource }: { resource: Course }) {
  const content = (
    <div className="group card-hover cursor-pointer relative overflow-hidden rounded-[1.75rem] border border-border bg-background/55 p-6">
      {resource.image ? (
        <div className="relative mb-5 h-36 overflow-hidden rounded-[1.3rem]">
          <Image src={resource.image} alt={resource.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
        </div>
      ) : (
        <div
          className="absolute right-0 top-0 h-40 w-40 opacity-[0.08]"
          style={{ background: `radial-gradient(circle, ${resource.accentColor} 0%, transparent 70%)` }}
        />
      )}

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-[1rem] text-sm font-extrabold"
            style={{ background: `${resource.accentColor}18`, color: resource.accentColor }}
          >
            {resource.icon}
          </div>
          <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-foreground/42">
            {resource.category}
          </span>
        </div>

        <h3 className="mt-5 text-xl font-semibold text-foreground transition-colors group-hover:text-accent">
          {resource.title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-foreground/58">{resource.description}</p>

        <div className="mt-5 flex items-center justify-between gap-4">
          <span className="text-xs text-foreground/42">
            {resource.external ? "Wejście zewnętrzne" : `${resource.lessons} lekcji`}
          </span>
          {resource.external && (
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-gold)]">
              Otwórz →
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (resource.external) {
    return (
      <a href={resource.external} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return <Link href={`/programy/${resource.id}`}>{content}</Link>;
}

export default async function SkarbiecPage() {
  const all = await getEffectiveResources();
  const items = all.filter((r) => r.enabled);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <section className="section-shell rounded-[2rem] p-8 sm:p-10">
        <div className="relative z-10 max-w-2xl">
          <p className="eyebrow">Skarbiec</p>
          <h1 className="display-title mt-4 text-5xl text-foreground sm:text-6xl">
            Zasoby i narzędzia do codziennej pracy.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-foreground/66 sm:text-lg">
            Miejsce na wszystko, do czego wracasz po warsztatach — playbooki, checklisty, narzędzia i wejścia zewnętrzne.
          </p>
        </div>
      </section>

      {collections.map((collection) => {
        const sectionItems = items.filter((resource) => collection.categories.includes(resource.category));
        if (!sectionItems.length) return null;

        return (
          <section key={collection.title} className="section-shell rounded-[2rem] p-6 sm:p-8">
            <div className="relative z-10">
              <div className="mb-6">
                <p className="eyebrow">{collection.title}</p>
                <h2 className="mt-3 font-display text-3xl text-foreground">{collection.description}</h2>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {sectionItems.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
