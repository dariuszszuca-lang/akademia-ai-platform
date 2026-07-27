import Link from 'next/link'
import { redirect } from 'next/navigation'
import OnboardingCard from '@/components/onboarding/OnboardingCard'
import { buildPropertyDashboard } from '@/features/properties/dashboard'
import { getPropertyService } from '@/features/properties/server-repository'
import { getServerUserId } from '@/lib/session'
import PropertyCard from '../nieruchomosci/PropertyCard'

export const dynamic = 'force-dynamic'

export default async function StartPage() {
  const userId = await getServerUserId()
  if (!userId) redirect('/login')

  const service = getPropertyService()
  const projects = await service.listProjects(userId)
  const factEntries = await Promise.all(
    projects.map(async (project) => [
      project.id,
      await service.listFacts(userId, project.id),
    ] as const),
  )
  const dashboard = buildPropertyDashboard(projects, new Map(factEntries))
  const nextAction = getNextAction(
    dashboard.conflictingCount,
    dashboard.missingCount,
    dashboard.activeCount,
  )

  return (
    <div className="animate-fade-in-up space-y-7">
      <header className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#0d171b] px-5 py-8 shadow-[0_30px_90px_-45px_rgba(0,0,0,0.9)] sm:px-8 lg:px-10 lg:py-10">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-32 h-80 w-80 rounded-full border border-[#bd9360]/20"
        />
        <div
          aria-hidden="true"
          className="absolute -right-2 -top-16 h-56 w-56 rounded-full border border-[#2d6b68]/45"
        />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-end">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#d8b784]">
              Property Intelligence Studio
            </p>
            <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.7rem,7vw,5.35rem)] leading-[0.92] tracking-[-0.04em] text-[#f7f2e7]">
              Dowody, decyzje
              <br />
              <em className="font-normal text-[#79aaa4]">i następny ruch.</em>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-[#bdc9c5] sm:text-base">
              Każda oferta zaczyna się od jednej teczki. Studio pokazuje, co
              jest potwierdzone, czego brakuje i gdzie potrzebna jest Twoja
              decyzja.
            </p>
          </div>

          <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm sm:p-6">
            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-[#d8b784]">
              Następne działanie
            </p>
            <h2 className="mt-3 font-display text-2xl text-[#f7f2e7]">
              {nextAction.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#9fafaa]">
              {nextAction.description}
            </p>
            <Link
              href={nextAction.href}
              className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#f7f2e7] px-5 text-sm font-semibold text-[#162026] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9360]"
            >
              {nextAction.label} →
            </Link>
          </section>
        </div>
      </header>

      <section
        aria-label="Stan portfolio"
        className="grid gap-3 sm:grid-cols-3"
      >
        <Metric
          label="Aktywne teczki"
          value={dashboard.activeCount}
          tone="teal"
        />
        <Metric
          label="Brakujące fakty"
          value={dashboard.missingCount}
          tone="gold"
        />
        <Metric
          label="Konflikty danych"
          value={dashboard.conflictingCount}
          tone="alert"
        />
      </section>

      <section className="rounded-[2.25rem] bg-[#f2ede3] p-4 text-[#162026] shadow-[0_30px_90px_-48px_rgba(0,0,0,0.75)] sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-4 border-b border-[#d9d2c5] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-[#8b693e]">
              Ostatnia praca
            </p>
            <h2 className="mt-2 font-display text-3xl tracking-[-0.02em]">
              Teczki, do których wracasz
            </h2>
          </div>
          <Link
            href="/nieruchomosci"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-[#285d5a] underline-offset-4 hover:underline"
          >
            Całe Portfolio →
          </Link>
        </div>

        {dashboard.recentProjects.length > 0 ? (
          <div className="stagger-children grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.recentProjects.map((project) => (
              <PropertyCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-[#bbb4a7] bg-[#fffdf8]/70 px-6 text-center">
            <span className="font-display text-4xl text-[#2d6b68]">01</span>
            <h3 className="mt-4 font-display text-2xl">
              Zacznij od prawdziwej nieruchomości
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#66716d]">
              Załóż pierwszą teczkę i uporządkuj fakty, zanim powstanie opis,
              rolka lub kampania.
            </p>
            <Link
              href="/nieruchomosci"
              className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#162026] px-5 text-sm font-semibold text-[#f7f2e7]"
            >
              Utwórz pierwszą teczkę →
            </Link>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
        <OnboardingCard />
        <section className="rounded-[2rem] border border-white/10 bg-[#15252a] p-6 text-[#f7f2e7]">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#79aaa4]">
            Zespół AI
          </p>
          <h2 className="mt-3 font-display text-2xl">
            Specjaliści do konkretnych zadań
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#aebdb8]">
            Wybierz agenta do analizy, wyceny, marketingu albo spraw prawnych.
          </p>
          <Link
            href="/agent"
            className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[#d8b784] hover:text-[#f0d4aa]"
          >
            Otwórz Zespół AI →
          </Link>
        </section>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'teal' | 'gold' | 'alert'
}) {
  const styles = {
    teal: 'border-[#365d59] bg-[#152b2d] text-[#9bc5bf]',
    gold: 'border-[#5d4b35] bg-[#2b251d] text-[#dfbd8b]',
    alert: 'border-[#67433c] bg-[#2d201e] text-[#e0a89d]',
  }

  return (
    <div className={`rounded-[1.5rem] border p-5 ${styles[tone]}`}>
      <p className="font-mono text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-current/70">
        {label}
      </p>
    </div>
  )
}

function getNextAction(
  conflictingCount: number,
  missingCount: number,
  activeCount: number,
) {
  if (conflictingCount > 0) {
    return {
      title: 'Wyjaśnij konflikty danych',
      description: `${conflictingCount} ${
        conflictingCount === 1 ? 'fakt wymaga' : 'fakty wymagają'
      } porównania ze źródłami.`,
      href: '/nieruchomosci',
      label: 'Przejdź do teczek',
    }
  }

  if (missingCount > 0) {
    return {
      title: 'Uzupełnij brakujące fakty',
      description: `${missingCount} ${
        missingCount === 1 ? 'informacja czeka' : 'informacje czekają'
      } na potwierdzenie.`,
      href: '/nieruchomosci',
      label: 'Otwórz Portfolio',
    }
  }

  if (activeCount > 0) {
    return {
      title: 'Teczki są gotowe do dalszej pracy',
      description:
        'Przejdź do wybranej nieruchomości albo uruchom specjalistę z Zespołu AI.',
      href: '/agent',
      label: 'Otwórz Zespół AI',
    }
  }

  return {
    title: 'Załóż pierwszą teczkę',
    description:
      'Dodaj prawdziwą nieruchomość i zbuduj dla niej jedno źródło prawdy.',
    href: '/nieruchomosci',
    label: 'Otwórz Portfolio',
  }
}
