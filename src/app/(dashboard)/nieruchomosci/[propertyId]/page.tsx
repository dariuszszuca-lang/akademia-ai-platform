import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  getFactStatusPresentation,
  getPropertyStageLabel,
  getPropertyTypeLabel,
  getTransactionTypeLabel,
  getUnresolvedFacts,
} from '@/features/properties/presentation'
import { getPropertyService } from '@/features/properties/server-repository'
import { getServerUserId } from '@/lib/session'
import AddFactForm from './AddFactForm'
import FactsBoard from './FactsBoard'
import PropertyWorkspaceTabs from './PropertyWorkspaceTabs'

export const dynamic = 'force-dynamic'

type PropertyWorkspacePageProps = {
  params: Promise<{
    propertyId: string
  }>
}

export default async function PropertyWorkspacePage({
  params,
}: PropertyWorkspacePageProps) {
  const { propertyId } = await params
  const userId = await getServerUserId()
  if (!userId) redirect('/login')

  const service = getPropertyService()
  const [project, facts] = await loadPropertyWorkspace(
    userId,
    propertyId,
  )
  const unresolved = getUnresolvedFacts(facts)
  const confirmedCount = facts.filter(
    (fact) => fact.status === 'confirmed',
  ).length

  return (
    <div className="animate-fade-in-up space-y-6">
      <header className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#0d171b] px-5 py-6 shadow-[0_30px_90px_-45px_rgba(0,0,0,0.9)] sm:px-8 sm:py-8">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-[#bd9360]/20"
        />
        <div className="relative">
          <Link
            href="/nieruchomosci"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-[#b9c7c2] outline-none hover:text-white focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-[#bd9360]"
          >
            <span aria-hidden="true">←</span>
            Portfolio
          </Link>

          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-full border border-[#79aaa4]/30 bg-[#79aaa4]/10 px-3 py-1 text-[0.67rem] font-semibold text-[#b9ddd7]">
                  {getPropertyStageLabel(project.stage)}
                </span>
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#d8b784]">
                  {getPropertyTypeLabel(project.propertyType)} ·{' '}
                  {getTransactionTypeLabel(project.transactionType)}
                </span>
              </div>
              <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.6rem,6vw,4.8rem)] leading-[0.95] tracking-[-0.035em] text-[#f7f2e7]">
                {project.title}
              </h1>
              <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#b9c7c2]">
                <span>
                  {[project.city, project.district].filter(Boolean).join(' · ')}
                </span>
                {project.addressMode === 'exact' && project.address && (
                  <>
                    <span aria-hidden="true" className="text-[#677873]">
                      /
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true">⌾</span>
                      Adres prywatny: {project.address}
                    </span>
                  </>
                )}
              </p>
            </div>

            <dl className="grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <Metric label="Fakty" value={facts.length} />
              <Metric label="Potwierdzone" value={confirmedCount} />
              <Metric label="Do wyjaśnienia" value={unresolved.length} alert />
            </dl>
          </div>
        </div>
      </header>

      <PropertyWorkspaceTabs propertyId={project.id} active="facts" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
        <main className="rounded-[2.25rem] bg-[#f2ede3] p-4 text-[#162026] shadow-[0_30px_90px_-48px_rgba(0,0,0,0.75)] sm:p-6 lg:p-8">
          <div className="mb-7 flex flex-col gap-4 border-b border-[#d9d2c5] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-[#8b693e]">
                Źródło prawdy
              </p>
              <h2 className="mt-2 font-display text-3xl tracking-[-0.02em]">
                Paszport faktów
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#65706c]">
                Każda informacja ma status, widoczność i historię wersji.
              </p>
            </div>
            <span className="font-mono text-xs text-[#7a837f]">
              {String(facts.length).padStart(2, '0')} wpisów
            </span>
          </div>

          <FactsBoard facts={facts} />
        </main>

        <aside className="space-y-5">
          <section className="rounded-[2rem] border border-white/10 bg-[#15252a] p-5 text-[#f7f2e7] sm:p-6">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#d8b784]">
              Następny krok
            </p>
            <h2 className="mt-2 font-display text-2xl">Uzupełnij paszport</h2>
            <p className="mt-2 text-sm leading-6 text-[#aebdb8]">
              Dodawaj tylko informacje, które mają jasno określony status.
              Dokumenty i propozycje AI znajdziesz w zakładce Źródła.
            </p>
            <div className="mt-5">
              <AddFactForm propertyId={project.id} />
            </div>
          </section>

          <section className="rounded-[2rem] border border-[#ded8cc] bg-[#fffdf8] p-5 text-[#162026] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#8b693e]">
                  Braki i konflikty
                </p>
                <h2 className="mt-2 font-display text-2xl">
                  {unresolved.length === 0
                    ? 'Brak otwartych kwestii'
                    : `${unresolved.length} ${
                        unresolved.length === 1 ? 'kwestia' : 'kwestie'
                      }`}
                </h2>
              </div>
              <span className="flex h-10 min-w-10 items-center justify-center rounded-full bg-[#f3e4ce] font-mono text-sm font-semibold text-[#855e22]">
                {unresolved.length}
              </span>
            </div>

            {unresolved.length > 0 ? (
              <ul className="mt-5 space-y-2.5">
                {unresolved.map((fact) => {
                  const status = getFactStatusPresentation(fact.status)
                  return (
                    <li
                      key={fact.id}
                      className="flex items-start gap-3 rounded-xl border border-[#e4ded3] bg-[#f8f4ec] p-3"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#f0ddc1] font-mono text-xs text-[#855e22]"
                      >
                        {status.symbol}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">
                          {fact.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-[#727a77]">
                          {status.label}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[#65706c]">
                Gdy oznaczysz fakt jako brakujący lub sprzeczny, pojawi się
                tutaj jako konkretne zadanie do wyjaśnienia.
              </p>
            )}
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-[#101b1f] p-5 text-[#f7f2e7] sm:p-6">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#79aaa4]">
              Zasada Studio
            </p>
            <blockquote className="mt-3 font-display text-xl leading-snug text-[#e6e0d5]">
              Najpierw fakty. Potem kreacja.
            </blockquote>
            <p className="mt-3 text-xs leading-5 text-[#92a29d]">
              Materiały AI nie powinny samodzielnie zmieniać zatwierdzonych
              informacji o nieruchomości.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )

  async function loadPropertyWorkspace(user: string, propertyId: string) {
    try {
      return await Promise.all([
        service.getProject(user, propertyId),
        service.listFacts(user, propertyId),
      ])
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'PROPERTY_NOT_FOUND'
      ) {
        notFound()
      }
      throw error
    }
  }
}

function Metric({
  label,
  value,
  alert = false,
}: {
  label: string
  value: number
  alert?: boolean
}) {
  return (
    <div className="min-w-[6.2rem] px-3 py-3 text-center sm:min-w-[7.5rem] sm:px-5">
      <dd
        className={`font-display text-2xl ${
          alert && value > 0 ? 'text-[#e2b06f]' : 'text-[#f7f2e7]'
        }`}
      >
        {value}
      </dd>
      <dt className="mt-1 text-[0.59rem] font-semibold uppercase tracking-[0.12em] text-[#879792]">
        {label}
      </dt>
    </div>
  )
}
