import Link from 'next/link'
import { redirect } from 'next/navigation'
import { buildPropertyDashboard } from '@/features/properties/dashboard'
import { getPropertyService } from '@/features/properties/server-repository'
import { getServerUserId } from '@/lib/session'
import { TOOLS, TOOL_STATUS_LABEL, type Tool } from '@/lib/tools'

export const dynamic = 'force-dynamic'

export default async function StartPage() {
  const userId = await getServerUserId()
  if (!userId) redirect('/login')

  const service = getPropertyService()
  await service.recordSessionStarted(userId)
  const projects = await service.listProjects(userId)
  const factEntries = await Promise.all(
    projects.map(async (project) => [
      project.id,
      await service.listFacts(userId, project.id),
    ] as const),
  )
  const dashboard = buildPropertyDashboard(projects, new Map(factEntries))

  const tools = TOOLS.filter((t) => t.id !== 'studio')
  const studio = TOOLS.find((t) => t.id === 'studio')

  return (
    <div className="animate-fade-in-up space-y-10">
      <header className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)] lg:items-end">
        <div>
          <p className="eyebrow">Moje narzędzia</p>
          <h1 className="mt-3 font-display text-[clamp(2.2rem,5vw,3.6rem)] font-bold leading-[1.02] tracking-[-0.03em] text-foreground">
            Cztery narzędzia, jedno konto.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-foreground/60">
            Sprawdź ceny, zrób protokół, przeczytaj księgę wieczystą i przejdź
            się po rzucie. Każde narzędzie otwierasz stąd.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3 rounded-2xl border border-border bg-[color:var(--card-strong)] p-4 font-mono text-xs">
          <Stat label="narzędzia" value={String(tools.length)} />
          <Stat label="działa" value={String(tools.filter((t) => t.status === 'dziala').length)} />
          <Stat label="teczki" value={String(dashboard.activeCount)} />
        </dl>
      </header>

      <section aria-labelledby="narzedzia" className="space-y-4">
        <h2 id="narzedzia" className="sr-only">
          Narzędzia
        </h2>
        <div className="stagger-children grid gap-4 md:grid-cols-2">
          {tools.map((tool, index) => (
            <ToolCard key={tool.id} tool={tool} index={index + 1} />
          ))}
        </div>
      </section>

      {studio && (
        <section
          aria-labelledby="studio"
          className="rounded-2xl border border-border bg-[color:var(--card-strong)] p-6 sm:p-8"
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(14rem,0.8fr)] lg:items-center">
            <div>
              <p className="eyebrow">Produkt dla agentów</p>
              <h2 id="studio" className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">
                {studio.name}
              </h2>
              <p className="mt-1 text-sm font-semibold text-accent">{studio.lead}</p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-foreground/60">
                {studio.description}
              </p>
              <Link
                href={studio.href}
                className="mt-5 inline-flex min-h-11 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
              >
                Otwórz Studio
              </Link>
            </div>
            <dl className="grid grid-cols-3 gap-3 font-mono text-xs">
              <Stat label="teczki" value={String(dashboard.activeCount)} />
              <Stat label="braki" value={String(dashboard.missingCount)} />
              <Stat label="konflikty" value={String(dashboard.conflictingCount)} />
            </dl>
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <dt className="text-[0.65rem] uppercase tracking-[0.12em] text-foreground/45">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  )
}

function ToolCard({ tool, index }: { tool: Tool; index: number }) {
  const label = TOOL_STATUS_LABEL[tool.status]
  const badge =
    tool.status === 'dziala'
      ? 'bg-accent text-white'
      : tool.status === 'pokaz'
        ? 'bg-[color:var(--slate-light)] text-foreground/70'
        : 'border border-border text-foreground/50'
  const action =
    tool.status === 'dziala'
      ? 'Otwórz'
      : tool.status === 'pokaz'
        ? 'Zobacz pokaz'
        : 'Wkrótce'
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-xs text-foreground/40">
          {String(index).padStart(2, '0')}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.1em] ${badge}`}
        >
          {label}
        </span>
      </div>
      <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-foreground">
        {tool.name}
      </h3>
      <p className="mt-1 text-sm font-semibold text-accent">{tool.lead}</p>
      <p className="mt-3 text-sm leading-6 text-foreground/60">{tool.description}</p>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="font-mono text-[0.7rem] text-foreground/45">{tool.audience}</span>
        <span className="text-sm font-semibold text-foreground">{action}</span>
      </div>
    </>
  )
  const className =
    'group block rounded-2xl border border-border bg-[color:var(--card-strong)] p-6 transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

  if (tool.status === 'wkrotce') {
    return <div className={className}>{body}</div>
  }
  if (tool.external) {
    return (
      <a href={tool.href} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    )
  }
  return (
    <Link href={tool.href} className={className}>
      {body}
    </Link>
  )
}
