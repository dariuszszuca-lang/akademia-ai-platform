import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  getPropertyStageLabel,
  getPropertyTypeLabel,
  getTransactionTypeLabel,
} from '@/features/properties/presentation'
import { getPropertyService } from '@/features/properties/server-repository'
import {
  type PropertyFactProposalWire,
  type PropertySourceWire,
} from '@/features/property-sources/client'
import { getPropertySourceService } from '@/features/property-sources/server-repository'
import { getServerUserId } from '@/lib/session'
import PropertyWorkspaceTabs from '../PropertyWorkspaceTabs'
import PropertySourceDesk from './PropertySourceDesk'

export const dynamic = 'force-dynamic'

type PropertySourcesPageProps = {
  params: Promise<{
    propertyId: string
  }>
}

export default async function PropertySourcesPage({
  params,
}: PropertySourcesPageProps) {
  const { propertyId } = await params
  const userId = await getServerUserId()
  if (!userId) redirect('/login')

  const propertyService = getPropertyService()
  const sourceService = getPropertySourceService()
  let workspace
  try {
    workspace = await Promise.all([
      propertyService.getProject(userId, propertyId),
      sourceService.listSources(userId, propertyId),
      sourceService.listProposals(userId, propertyId),
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

  const [project, sources, proposals] = workspace
  const pendingCount = proposals.filter((proposal) =>
    ['pending', 'conflict', 'needs_review'].includes(proposal.status),
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
              <p className="mt-4 text-sm text-[#b9c7c2]">
                {[project.city, project.district].filter(Boolean).join(' · ')}
              </p>
            </div>

            <dl className="grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <Metric label="Źródła" value={sources.length} />
              <Metric
                label="Gotowe"
                value={
                  sources.filter((source) =>
                    ['review_ready', 'completed'].includes(source.status),
                  ).length
                }
              />
              <Metric
                label="Do decyzji"
                value={pendingCount}
                alert={pendingCount > 0}
              />
            </dl>
          </div>
        </div>
      </header>

      <PropertyWorkspaceTabs propertyId={project.id} active="sources" />

      <PropertySourceDesk
        propertyId={project.id}
        initialSources={sources.map(serializeSource)}
        initialProposals={proposals.map(serializeProposal)}
      />
    </div>
  )
}

function serializeSource(
  source: Awaited<
    ReturnType<
      ReturnType<typeof getPropertySourceService>['listSources']
    >
  >[number],
): PropertySourceWire {
  return {
    ...source,
    uploadedAt: source.uploadedAt?.toISOString() ?? null,
    processedAt: source.processedAt?.toISOString() ?? null,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  }
}

function serializeProposal(
  proposal: Awaited<
    ReturnType<
      ReturnType<typeof getPropertySourceService>['listProposals']
    >
  >[number],
): PropertyFactProposalWire {
  return {
    ...proposal,
    decidedAt: proposal.decidedAt?.toISOString() ?? null,
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString(),
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
          alert ? 'text-[#e2b06f]' : 'text-[#f7f2e7]'
        }`}
      >
        {value}
      </dd>
      <dt className="mt-1 text-[0.61rem] uppercase tracking-[0.13em] text-[#8ea09a]">
        {label}
      </dt>
    </div>
  )
}
