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
    <article className="group relative overflow-hidden rounded-[1.75rem] border border-[#ded8cb] bg-[#fffdf8] p-5 text-[#162026] shadow-[0_18px_50px_-38px_rgba(13,23,27,0.55)] transition duration-300 hover:-translate-y-1 hover:border-[#9db8b4] hover:shadow-[0_28px_70px_-42px_rgba(13,23,27,0.7)] motion-reduce:transform-none">
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#2d6b68] via-[#2d6b68] to-[#bd9360]"
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-[#6b746f]">
            {getPropertyTypeLabel(project.propertyType)} ·{' '}
            {getTransactionTypeLabel(project.transactionType)}
          </p>
          <h2 className="mt-3 font-display text-[1.65rem] leading-[1.05] tracking-[-0.02em]">
            {project.title}
          </h2>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#bfd0cc] bg-[#edf4f1] px-3 py-1.5 text-[0.68rem] font-semibold text-[#285d5a]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2d6b68]" />
          {getPropertyStageLabel(project.stage)}
        </span>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-[#e5dfd3] pt-4">
        <div>
          <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#7c837e]">
            Lokalizacja
          </dt>
          <dd className="mt-1.5 text-sm font-medium">{location}</dd>
        </div>
        <div>
          <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#7c837e]">
            Ostatnia zmiana
          </dt>
          <dd className="mt-1.5 font-mono text-xs text-[#45524f]">
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
        className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#285d5a] outline-none after:absolute after:inset-0 focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-[#2d6b68] focus-visible:ring-offset-4 focus-visible:ring-offset-[#fffdf8]"
        aria-label={`Otwórz teczkę: ${project.title}`}
      >
        Otwórz teczkę
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
