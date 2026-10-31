'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { OpenIssue } from '@/features/properties/open-issues'
import { getFactCategoryLabel } from '@/features/properties/presentation'
import { formatEvidenceLocator } from '@/features/property-sources/client'

type OpenIssuesBoardProps = {
  propertyId: string
  issues: OpenIssue[]
}

type IssueFilter = 'all' | OpenIssue['kind']

const issuePresentation: Record<
  OpenIssue['kind'],
  {
    label: string
    eyebrow: string
    marker: string
    className: string
    badgeClassName: string
  }
> = {
  conflict: {
    label: 'Konflikt',
    eyebrow: 'Wymaga decyzji',
    marker: '01',
    className: 'border-l-[#b86554]',
    badgeClassName:
      'border-[#d9a89d] bg-[#f8e9e5] text-[#884235]',
  },
  needs_review: {
    label: 'Do sprawdzenia',
    eyebrow: 'Wymaga źródła',
    marker: '02',
    className: 'border-l-accent',
    badgeClassName:
      'border-[#dfc59b] bg-[#fbf1dd] text-accent',
  },
  missing: {
    label: 'Brak danych',
    eyebrow: 'Do uzupełnienia',
    marker: '03',
    className: 'border-l-accent',
    badgeClassName:
      'border-accent/30 bg-accent/10 text-accent',
  },
}

const filterOptions: {
  id: IssueFilter
  label: string
}[] = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'conflict', label: 'Konflikty' },
  { id: 'needs_review', label: 'Do sprawdzenia' },
  { id: 'missing', label: 'Braki' },
]

export default function OpenIssuesBoard({
  propertyId,
  issues,
}: OpenIssuesBoardProps) {
  const [activeFilter, setActiveFilter] =
    useState<IssueFilter>('all')
  const visibleIssues =
    activeFilter === 'all'
      ? issues
      : issues.filter((issue) => issue.kind === activeFilter)

  return (
    <section
      aria-labelledby="open-issues-title"
      className="overflow-hidden rounded-[2rem] border border-border bg-[color:var(--card-strong)] shadow-[var(--shadow-card)]"
    >
      <div className="border-b border-border px-5 py-6 sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-accent">
              Stół weryfikacyjny
            </p>
            <h2
              id="open-issues-title"
              className="mt-2 font-display text-3xl tracking-[-0.025em] text-foreground sm:text-4xl"
            >
              Braki i konflikty
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/60">
              Jedna kolejka rzeczy, które blokują wiarygodną kartę.
              Najpierw rozstrzygnij konflikty, potem uzupełnij brakujące
              fakty.
            </p>
          </div>

          <dl className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-[color:var(--card-strong)]">
            <IssueMetric
              label="Konflikty"
              value={countIssues(issues, 'conflict')}
            />
            <IssueMetric
              label="Sprawdź"
              value={countIssues(issues, 'needs_review')}
            />
            <IssueMetric
              label="Braki"
              value={countIssues(issues, 'missing')}
            />
          </dl>
        </div>

        <div
          aria-label="Filtry otwartych kwestii"
          className="mt-6 flex gap-2 overflow-x-auto pb-1"
          role="group"
        >
          {filterOptions.map((filter) => {
            const selected = activeFilter === filter.id
            const count =
              filter.id === 'all'
                ? issues.length
                : countIssues(issues, filter.id)

            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setActiveFilter(filter.id)}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--card-strong)] ${
                  selected
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-[color:var(--card-strong)] text-foreground/80 hover:border-accent hover:text-foreground'
                }`}
              >
                {filter.label}
                <span
                  className={`font-mono text-[0.65rem] ${
                    selected ? 'text-background/70' : 'text-foreground/60'
                  }`}
                >
                  {String(count).padStart(2, '0')}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {visibleIssues.length > 0 ? (
        <div className="divide-y divide-border">
          {visibleIssues.map((issue) => (
            <IssueRow
              key={issue.id}
              propertyId={propertyId}
              issue={issue}
            />
          ))}
        </div>
      ) : (
        <div className="px-5 py-14 text-center sm:px-8 sm:py-20">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-accent/30 bg-accent/10 font-mono text-sm font-semibold text-accent">
            00
          </span>
          <h3 className="mt-5 font-display text-2xl text-foreground">
            Brak otwartych kwestii
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-foreground/60">
            Karta nie wymaga teraz wyjaśnień. Nowe braki i konflikty
            pojawią się tutaj automatycznie.
          </p>
        </div>
      )}
    </section>
  )
}

function IssueRow({
  propertyId,
  issue,
}: {
  propertyId: string
  issue: OpenIssue
}) {
  const presentation = issuePresentation[issue.kind]
  const locator = issue.evidenceLocator
    ? formatEvidenceLocator(issue.evidenceLocator)
    : null
  const action = getIssueAction(propertyId, issue)

  return (
    <article
      className={`grid border-l-4 bg-[color:var(--card-strong)] px-5 py-6 ${presentation.className} sm:px-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[0.67rem] font-semibold ${presentation.badgeClassName}`}
          >
            {presentation.label}
          </span>
          <span className="font-mono text-[0.63rem] uppercase tracking-[0.14em] text-foreground/60">
            P{issue.priority} · {presentation.eyebrow}
          </span>
        </div>

        <div className="mt-3 flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background font-mono text-[0.65rem] text-accent sm:flex"
          >
            {presentation.marker}
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">
              {issue.label}
            </h3>
            <p className="mt-1 break-words font-mono text-[0.66rem] leading-5 text-foreground/60">
              {getFactCategoryLabel(issue.category)} · {issue.factKey}
              {locator ? ` · ${locator}` : ''}
            </p>
          </div>
        </div>
      </div>

      <Link
        href={action.href}
        className="mt-5 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full border border-[#9f835f] bg-transparent px-5 py-2.5 text-sm font-semibold text-accent outline-none transition-colors duration-200 hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--card-strong)] lg:mt-0 lg:w-auto"
      >
        {action.label}
        <span aria-hidden="true" className="ml-2">
          →
        </span>
      </Link>
    </article>
  )
}

function IssueMetric({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="min-w-[5.7rem] px-3 py-3 text-center sm:min-w-[6.8rem] sm:px-4">
      <dd className="font-display text-2xl text-foreground">{value}</dd>
      <dt className="mt-1 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-foreground/60">
        {label}
      </dt>
    </div>
  )
}

function countIssues(
  issues: OpenIssue[],
  kind: OpenIssue['kind'],
): number {
  return issues.filter((issue) => issue.kind === kind).length
}

function getIssueAction(
  propertyId: string,
  issue: OpenIssue,
): { href: string; label: string } {
  if (issue.action === 'decide_proposal') {
    return {
      href: `/nieruchomosci/${propertyId}/zrodla?proposal=${encodeURIComponent(issue.proposalId ?? '')}`,
      label: 'Rozstrzygnij propozycję',
    }
  }
  if (issue.action === 'open_source') {
    return {
      href: `/nieruchomosci/${propertyId}/zrodla?source=${encodeURIComponent(issue.sourceId ?? '')}`,
      label: 'Otwórz źródło',
    }
  }
  return {
    href: `/nieruchomosci/${propertyId}?fact=${encodeURIComponent(issue.factId ?? '')}`,
    label: 'Uzupełnij fakt',
  }
}
