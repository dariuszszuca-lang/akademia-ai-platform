import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { presentAuditRecord } from '@/features/properties/audit-presentation'
import {
  getPropertyStageLabel,
  getPropertyTypeLabel,
  getTransactionTypeLabel,
} from '@/features/properties/presentation'
import { getPropertyService } from '@/features/properties/server-repository'
import { getServerUserId } from '@/lib/session'
import PropertyWorkspaceTabs from '../PropertyWorkspaceTabs'
import PropertyHistory from './PropertyHistory'

export const dynamic = 'force-dynamic'

type PropertyHistoryPageProps = {
  params: Promise<{
    propertyId: string
  }>
}

export default async function PropertyHistoryPage({
  params,
}: PropertyHistoryPageProps) {
  const { propertyId } = await params
  const userId = await getServerUserId()
  if (!userId) redirect('/login')

  const propertyService = getPropertyService()
  let workspace

  try {
    workspace = await Promise.all([
      propertyService.getProject(userId, propertyId),
      propertyService.listAudit(userId, propertyId),
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

  const [project, audit] = workspace
  const entries = audit.map(presentAuditRecord)
  const aiEvents = entries.filter(
    (entry) => entry.actorLabel === 'AI',
  ).length
  const integrationEvents = entries.filter(
    (entry) => entry.actorLabel === 'Integracja',
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
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[#b9c7c2] outline-none transition-colors hover:text-white focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-[#bd9360]"
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
              <p className="mt-4 text-sm text-[#b9c7c2]">
                {[project.city, project.district]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>

            <dl className="grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <Metric label="Zdarzenia" value={entries.length} />
              <Metric label="AI" value={aiEvents} />
              <Metric label="Integracje" value={integrationEvents} />
            </dl>
          </div>
        </div>
      </header>

      <PropertyWorkspaceTabs propertyId={project.id} active="history" />

      <PropertyHistory propertyId={project.id} entries={entries} />
    </div>
  )
}

function Metric({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="min-w-[6.2rem] px-3 py-3 text-center sm:min-w-[7.5rem] sm:px-5">
      <dd className="font-display text-2xl text-[#f7f2e7]">{value}</dd>
      <dt className="mt-1 text-[0.61rem] uppercase tracking-[0.13em] text-[#8ea09a]">
        {label}
      </dt>
    </div>
  )
}
