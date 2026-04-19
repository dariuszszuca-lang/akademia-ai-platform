import Link from "next/link";
import { getEffectiveModules, getEffectiveResources } from "@/lib/module-overrides";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  const [allModules, allResources] = await Promise.all([
    getEffectiveModules(),
    getEffectiveResources(),
  ]);

  const enabledModules = allModules.filter((m) => m.enabled && (m.items?.length ?? 0) > 0);
  const continueModule = enabledModules.find((m) => m.id === "przygotowanie") ?? enabledModules[0];
  const continueLesson = continueModule?.items?.[0];

  const enabledResources = allResources.filter((r) => r.enabled).slice(0, 3);

  const nextLive =
    enabledModules.find((m) => m.id === "dzien-1-online") ??
    enabledModules.find((m) => m.id === "dzien-4-qa-online");

  return (
    <div className="mx-auto max-w-4xl space-y-10 animate-fade-in-up">
      <header>
        <p className="eyebrow">Akademia AI</p>
        <h1 className="display-title mt-3 text-4xl text-foreground sm:text-5xl">
          Cześć. Zacznijmy od tego co najważniejsze.
        </h1>
      </header>

      {continueModule && continueLesson ? (
        <Link
          href={`/classroom/${continueModule.id}?lesson=${continueLesson.id}`}
          className="group block rounded-[2rem] border border-border bg-[color:var(--card)] p-8 transition hover:border-foreground/40 sm:p-10"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p
                className="text-[0.7rem] font-semibold uppercase tracking-[0.22em]"
                style={{ color: continueModule.accentColor }}
              >
                Kontynuuj
              </p>
              <h2 className="mt-3 font-display text-3xl text-foreground">
                {continueLesson.title}
              </h2>
              <p className="mt-2 text-sm text-foreground/55">
                {continueModule.title}
                {continueLesson.duration && ` · ${continueLesson.duration} min`}
              </p>
            </div>
            <div className="shrink-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition group-hover:opacity-90">
                Wejdź
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </div>
          </div>
        </Link>
      ) : (
        <div className="rounded-[2rem] border border-dashed border-border bg-background/35 p-8 text-center">
          <p className="text-sm text-foreground/60">
            Moduły zostaną otwarte przez prowadzącego w odpowiednim momencie.
          </p>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {nextLive && (
          <section className="rounded-[2rem] border border-border bg-background/55 p-6">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
              Na żywo
            </p>
            <h3 className="mt-3 font-display text-xl text-foreground">
              {nextLive.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-foreground/55">{nextLive.description}</p>
            {nextLive.meta && (
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-gold)]">
                {nextLive.meta}
              </p>
            )}
            <Link
              href="/na-zywo"
              className="mt-4 inline-block text-sm font-semibold text-foreground/80 underline-offset-4 hover:underline"
            >
              Kalendarz →
            </Link>
          </section>
        )}

        {enabledResources.length > 0 && (
          <section className="rounded-[2rem] border border-border bg-background/55 p-6">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
              Skarbiec — najnowsze
            </p>
            <ul className="mt-4 space-y-3">
              {enabledResources.map((r) => (
                <li key={r.id}>
                  <Link
                    href={r.external ?? `/skarbiec`}
                    target={r.external ? "_blank" : undefined}
                    rel={r.external ? "noopener noreferrer" : undefined}
                    className="flex items-start gap-3 text-sm text-foreground/75 hover:text-foreground"
                  >
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[0.65rem] font-extrabold"
                      style={{
                        background: `${r.accentColor}18`,
                        color: r.accentColor,
                      }}
                    >
                      {r.icon}
                    </span>
                    <span className="flex-1 leading-snug">{r.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/skarbiec"
              className="mt-4 inline-block text-sm font-semibold text-foreground/80 underline-offset-4 hover:underline"
            >
              Cały skarbiec →
            </Link>
          </section>
        )}
      </div>

      <div className="flex flex-col items-start gap-4 rounded-[2rem] border border-border bg-[color:var(--card)] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
            Twój asystent
          </p>
          <h3 className="mt-2 font-display text-xl text-foreground">
            Pracuj z AI przy codziennych zadaniach.
          </h3>
        </div>
        <Link
          href="/agent"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background/55 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-foreground/40"
        >
          Otwórz Agenta →
        </Link>
      </div>
    </div>
  );
}
