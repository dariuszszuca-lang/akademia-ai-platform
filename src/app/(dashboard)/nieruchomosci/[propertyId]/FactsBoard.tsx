import type { PropertyFact } from '@/features/properties/domain'
import {
  formatFactValue,
  getFactCategoryLabel,
  getFactStatusPresentation,
  getFactVisibilityLabel,
} from '@/features/properties/presentation'

type FactsBoardProps = {
  facts: PropertyFact[]
}

const statusClassNames: Record<string, string> = {
  success: 'border-[#a9c8b5] bg-[#e9f3ec] text-[#2f6547]',
  info: 'border-[#b9ccd2] bg-[#edf3f5] text-[#3f626c]',
  ai: 'border-[#c9bfda] bg-[#f2eef8] text-[#66517e]',
  danger: 'border-[#ddb6ad] bg-[#f9ece8] text-[#92483b]',
  warning: 'border-[#dfc59b] bg-[#fbf1dd] text-[#855e22]',
  neutral: 'border-[#d4d4ce] bg-[#f2f2ee] text-[#626560]',
}

export default function FactsBoard({ facts }: FactsBoardProps) {
  if (facts.length === 0) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-[#c9c2b5] bg-white/45 px-6 text-center">
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-[#8b693e]">
          Paszport pusty
        </span>
        <h3 className="mt-3 font-display text-2xl">Dodaj pierwszy fakt</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#65706c]">
          Zacznij od informacji, którą można nazwać, oznaczyć statusem i
          świadomie dopuścić do materiałów.
        </p>
      </div>
    )
  }

  const groups = groupFacts(facts)

  return (
    <div className="space-y-7">
      {groups.map(([category, categoryFacts]) => (
        <section key={category} aria-labelledby={`category-${category}`}>
          <div className="mb-3 flex items-center gap-3">
            <h3
              id={`category-${category}`}
              className="font-display text-xl text-[#162026]"
            >
              {getFactCategoryLabel(category)}
            </h3>
            <span className="font-mono text-[0.65rem] text-[#7a837f]">
              {String(categoryFacts.length).padStart(2, '0')}
            </span>
            <span className="h-px flex-1 bg-[#ded8cc]" />
          </div>

          <div className="divide-y divide-[#e4ded3] overflow-hidden rounded-[1.4rem] border border-[#ded8cc] bg-[#fffdf8]">
            {categoryFacts.map((fact) => {
              const status = getFactStatusPresentation(fact.status)
              const value = formatFactValue(
                fact.value,
                fact.valueType,
                fact.unit,
              )

              return (
                <article
                  key={fact.id}
                  className="grid gap-4 px-4 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,0.8fr)] sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.66rem] font-semibold ${statusClassNames[status.tone]}`}
                      >
                        <span
                          aria-hidden="true"
                          className="font-mono text-[0.62rem]"
                        >
                          {status.symbol}
                        </span>
                        {status.label}
                      </span>
                      <span className="rounded-full border border-[#d8d3c9] px-2.5 py-1 text-[0.65rem] font-medium text-[#69716e]">
                        {getFactVisibilityLabel(fact.visibility)}
                      </span>
                    </div>
                    <h4 className="mt-3 text-sm font-semibold text-[#263330]">
                      {fact.label}
                    </h4>
                    <p className="mt-1 font-mono text-[0.65rem] text-[#89908d]">
                      {fact.key} · wersja {fact.version}
                    </p>
                  </div>

                  <div className="min-w-0 sm:text-right">
                    {fact.valueType === 'json' ? (
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-[#eef0eb] p-3 text-left font-mono text-xs leading-5 text-[#33423e]">
                        {value}
                      </pre>
                    ) : (
                      <p className="break-words font-display text-2xl leading-tight text-[#162026]">
                        {value}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-[#7b827f]">
                      {fact.sourceIds.length > 0
                        ? `${fact.sourceIds.length} ${
                            fact.sourceIds.length === 1 ? 'źródło' : 'źródła'
                          }`
                        : fact.confirmedByUserId
                          ? 'Potwierdzone przez użytkownika'
                          : 'Bez powiązanego źródła'}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function groupFacts(facts: PropertyFact[]): [string, PropertyFact[]][] {
  const groups = new Map<string, PropertyFact[]>()

  for (const fact of facts) {
    const group = groups.get(fact.category) ?? []
    group.push(fact)
    groups.set(fact.category, group)
  }

  return Array.from(groups.entries()).sort(([a], [b]) =>
    a.localeCompare(b, 'pl'),
  )
}
