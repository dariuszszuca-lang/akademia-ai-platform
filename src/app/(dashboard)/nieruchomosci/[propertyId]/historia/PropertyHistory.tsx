import Link from 'next/link'
import type { PresentedAuditRecord } from '@/features/properties/audit-presentation'

type PropertyHistoryProps = {
  propertyId: string
  entries: PresentedAuditRecord[]
}

const dayFormatter = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'full',
  timeZone: 'Europe/Warsaw',
})

const timeFormatter = new Intl.DateTimeFormat('pl-PL', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Warsaw',
})

const actorClassNames: Record<string, string> = {
  Użytkownik: 'border-[#b8d2cd] bg-[#e9f2ef] text-[#315f58]',
  AI: 'border-[#c9bfda] bg-[#f2eef8] text-[#66517e]',
  Integracja: 'border-[#c8c5bd] bg-[#f0efeb] text-[#5c625f]',
}

export default function PropertyHistory({
  propertyId,
  entries,
}: PropertyHistoryProps) {
  const groups = groupByDay(entries)

  return (
    <section
      aria-labelledby="property-history-title"
      className="overflow-hidden rounded-[2rem] border border-[#d8d1c5] bg-[#f4efe5] shadow-[0_24px_70px_-48px_rgba(22,32,38,0.55)]"
    >
      <header className="border-b border-[#d8d1c5] px-5 py-6 sm:px-7">
        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#8b693e]">
          Dziennik teczki
        </p>
        <h2
          id="property-history-title"
          className="mt-2 font-display text-3xl tracking-[-0.025em] text-[#162026] sm:text-4xl"
        >
          Historia zmian
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#65706c]">
          Bezpieczny zapis działań użytkownika, AI i integracji. Pełne
          wartości faktów oraz treści dokumentów nie są tu powielane.
        </p>
      </header>

      {groups.length > 0 ? (
        <div className="space-y-8 px-5 py-7 sm:px-7 sm:py-9">
          {groups.map((group) => (
            <section
              key={group.day}
              aria-labelledby={`history-day-${group.day}`}
            >
              <div className="mb-4 flex items-center gap-3">
                <h3
                  id={`history-day-${group.day}`}
                  className="font-display text-lg capitalize text-[#263330]"
                >
                  {group.label}
                </h3>
                <span className="font-mono text-[0.64rem] text-[#7a837f]">
                  {String(group.entries.length).padStart(2, '0')}
                </span>
                <span
                  aria-hidden="true"
                  className="h-px flex-1 bg-[#d8d1c5]"
                />
              </div>

              <ol className="relative space-y-3 before:absolute before:bottom-5 before:left-[1.15rem] before:top-5 before:w-px before:bg-[#cfc5b6]">
                {group.entries.map((entry) => (
                  <HistoryEntry
                    key={entry.id}
                    propertyId={propertyId}
                    entry={entry}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <div className="px-5 py-14 text-center sm:px-8 sm:py-20">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#d2c4ae] bg-[#f1e8d9] font-mono text-sm font-semibold text-[#715838]">
            00
          </span>
          <h3 className="mt-5 font-display text-2xl text-[#162026]">
            Historia jest jeszcze pusta
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#65706c]">
            Pierwsze bezpieczne zdarzenie pojawi się tutaj po zmianie
            teczki, faktu albo źródła.
          </p>
        </div>
      )}
    </section>
  )
}

function HistoryEntry({
  propertyId,
  entry,
}: {
  propertyId: string
  entry: PresentedAuditRecord
}) {
  const date = new Date(entry.createdAt)
  const href = historyEntryHref(propertyId, entry)
  const body = (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[0.66rem] font-semibold ${
            actorClassNames[entry.actorLabel] ??
            'border-[#c8c5bd] bg-[#f0efeb] text-[#5c625f]'
          }`}
        >
          {entry.actorLabel}
        </span>
        <time
          dateTime={entry.createdAt}
          className="font-mono text-[0.65rem] text-[#747d79]"
        >
          {timeFormatter.format(date)}
        </time>
      </div>
      <p className="mt-2 text-sm font-semibold text-[#263330]">
        {entry.label}
      </p>
      {entry.change ? (
        <p className="mt-1 text-sm leading-6 text-[#65706c]">
          {entry.change}
        </p>
      ) : null}
    </div>
  )

  return (
    <li className="relative flex gap-4 rounded-[1.25rem] border border-[#ddd6ca] bg-[#fffdf8] px-4 py-4 sm:px-5">
      <span
        aria-hidden="true"
        className="relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-[#fffdf8] bg-[#9c7b52] ring-1 ring-[#b9a587]"
      />
      {href ? (
        <Link
          href={href}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer rounded-lg outline-none transition-colors duration-200 hover:text-[#6f522e] focus-visible:ring-2 focus-visible:ring-[#8b693e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8]"
        >
          {body}
          <span
            aria-hidden="true"
            className="ml-3 self-center text-[#8b693e]"
          >
            →
          </span>
        </Link>
      ) : (
        body
      )}
    </li>
  )
}

function groupByDay(entries: PresentedAuditRecord[]) {
  const sorted = [...entries].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() -
      new Date(left.createdAt).getTime(),
  )
  const groups = new Map<
    string,
    { day: string; label: string; entries: PresentedAuditRecord[] }
  >()

  for (const entry of sorted) {
    const date = new Date(entry.createdAt)
    const day = dayKey(date)
    const group = groups.get(day) ?? {
      day,
      label: dayFormatter.format(date),
      entries: [],
    }
    group.entries.push(entry)
    groups.set(day, group)
  }

  return [...groups.values()]
}

function dayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Warsaw',
  }).formatToParts(date)
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  )
  return `${value.year}-${value.month}-${value.day}`
}

function historyEntryHref(
  propertyId: string,
  entry: PresentedAuditRecord,
): string | null {
  if (entry.entityType === 'property_fact') {
    return `/nieruchomosci/${propertyId}?fact=${encodeURIComponent(entry.entityId)}`
  }
  if (entry.entityType === 'property_source') {
    return `/nieruchomosci/${propertyId}/zrodla?source=${encodeURIComponent(entry.entityId)}`
  }
  if (entry.entityType === 'property_fact_proposal') {
    return `/nieruchomosci/${propertyId}/zrodla?proposal=${encodeURIComponent(entry.entityId)}`
  }
  return null
}
