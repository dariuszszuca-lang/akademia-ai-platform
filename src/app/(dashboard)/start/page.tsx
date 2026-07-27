import Link from "next/link";
import { getEffectiveModules, getEffectiveResources } from "@/lib/module-overrides";
import OnboardingCard from "@/components/onboarding/OnboardingCard";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  const [allModules, allResources] = await Promise.all([
    getEffectiveModules(),
    getEffectiveResources(),
  ]);

  const enabledModules = allModules.filter((m) => m.enabled && (m.items?.length ?? 0) > 0);

  const enabledResources = allResources.filter((r) => r.enabled).slice(0, 3);

  const nextLive =
    enabledModules.find((m) => m.id === "dzien-1-online") ??
    enabledModules.find((m) => m.id === "dzien-4-qa-online");

  return (
    <div className="mx-auto max-w-4xl space-y-10 animate-fade-in-up">
      <header className="space-y-4">
        <p className="eyebrow">Akademia AI</p>
        <h1 className="display-title text-foreground" style={{ fontSize: 'clamp(40px, 6vw, 64px)' }}>
          Cześć. Zacznijmy od <em>najważniejszego</em>.
        </h1>
        <p className="text-foreground/50 text-base sm:text-lg max-w-xl leading-relaxed">
          Twój kokpit AI dla pracy agenta nieruchomości. Naciśnij <span className="kbd">⌘</span> <span className="kbd">K</span> żeby od razu otworzyć agenta albo plik.
        </p>
      </header>

      <Link
        href="/nieruchomosci"
        className="group relative block overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d171b] p-6 shadow-[0_30px_90px_-45px_rgba(0,0,0,0.9)] outline-none transition duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-[#bd9360] focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-reduce:transform-none sm:p-8"
      >
        <span
          aria-hidden="true"
          className="absolute -right-16 -top-24 h-64 w-64 rounded-full border border-[#bd9360]/20"
        />
        <span
          aria-hidden="true"
          className="absolute -right-2 -top-14 h-44 w-44 rounded-full border border-[#2d6b68]/40"
        />
        <span className="relative flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <span>
            <span className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-[#d8b784]">
              Property Intelligence Studio
            </span>
            <span className="mt-3 block max-w-2xl font-display text-3xl leading-tight text-[#f7f2e7] sm:text-4xl">
              Otwórz teczkę nieruchomości.
            </span>
            <span className="mt-3 block max-w-2xl text-sm leading-6 text-[#aebdb8]">
              Zbierz fakty, oznacz braki i przygotuj ofertę na jednym źródle
              prawdy.
            </span>
          </span>
          <span className="inline-flex min-h-12 shrink-0 items-center gap-3 self-start rounded-full bg-[#f7f2e7] px-5 text-sm font-semibold text-[#162026] sm:self-auto">
            Wejdź do Studio
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none"
            >
              →
            </span>
          </span>
        </span>
      </Link>

      {/* Onboarding card, widoczny dopóki profil i persony niegotowe */}
      <OnboardingCard />

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
