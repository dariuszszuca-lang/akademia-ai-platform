import Link from 'next/link'
import { redirect } from 'next/navigation'
import { buildPropertyDashboard } from '@/features/properties/dashboard'
import { getPropertyService } from '@/features/properties/server-repository'
import { getServerUserId } from '@/lib/session'
import ToolCard from '@/components/tools/ToolCard'
import { TOOLS } from '@/lib/tools'

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
            Narzędzia do mieszkania, jedno konto.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-foreground/60">
            Sprawdź ceny, zrób protokół, przeczytaj księgę wieczystą, przygotuj umowę i przejdź
            się po rzucie. Każde narzędzie otwierasz stąd.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3 rounded-2xl border border-border bg-[color:var(--card-strong)] p-4 font-mono text-xs">
          <Stat label="narzędzia" value={String(tools.length)} />
          <Stat label="działa" value={String(tools.filter((t) => t.status === 'dziala').length)} />
          <Stat label="karty" value={String(dashboard.activeCount)} />
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
              <Stat label="karty" value={String(dashboard.activeCount)} />
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
