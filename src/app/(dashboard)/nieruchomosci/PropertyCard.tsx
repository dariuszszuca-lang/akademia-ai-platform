import Link from 'next/link'
import type { PropertyProject } from '@/features/properties/domain'
import {
  getPropertyStageLabel,
  getPropertyTypeLabel,
  getTransactionTypeLabel,
} from '@/features/properties/presentation'

type PropertyCardProps = {
  project: PropertyProject
}

export default function PropertyCard({ project }: PropertyCardProps) {
  const location = [project.city, project.district].filter(Boolean).join(' · ')

  return (
    <article className="group relative overflow-hidden rounded-[1.75rem] border border-border bg-[color:var(--card-strong)] p-5 text-foreground shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-[var(--shadow-card)] motion-reduce:transform-none">
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-accent via-accent to-accent"
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-foreground/60">
            {getPropertyTypeLabel(project.propertyType)} ·{' '}
            {getTransactionTypeLabel(project.transactionType)}
          </p>
          <h2 className="mt-3 font-display text-[1.65rem] leading-[1.05] tracking-[-0.02em]">
            {project.title}
          </h2>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-[0.68rem] font-semibold text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {getPropertyStageLabel(project.stage)}
        </span>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-4">
        <div>
          <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-foreground/60">
            Lokalizacja
          </dt>
          <dd className="mt-1.5 text-sm font-medium">{location}</dd>
        </div>
        <div>
          <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-foreground/60">
            Ostatnia zmiana
          </dt>
          <dd className="mt-1.5 font-mono text-xs text-foreground/80">
            {new Intl.DateTimeFormat('pl-PL', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }).format(project.updatedAt)}
          </dd>
        </div>
      </dl>

      <Link
        href={`/nieruchomosci/${project.id}`}
        className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent outline-none after:absolute after:inset-0 focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--card-strong)]"
        aria-label={`Otwórz kartę: ${project.title}`}
      >
        Otwórz kartę
        <span
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none"
        >
          →
        </span>
      </Link>
    </article>
  )
}
