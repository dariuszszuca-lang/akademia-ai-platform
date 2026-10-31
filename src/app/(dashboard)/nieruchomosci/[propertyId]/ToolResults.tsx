import Link from 'next/link'
import { getToolResultService } from '@/features/tool-results/server'
import { getTool } from '@/lib/tools'

const dataPl = (iso: string) => new Date(iso).toLocaleDateString('pl-PL')

export default async function ToolResults({ userId, propertyId }: { userId: string; propertyId: string }) {
  let results: Awaited<ReturnType<ReturnType<typeof getToolResultService>['list']>> = []
  try {
    results = await getToolResultService().list(userId, propertyId)
  } catch {
    results = []
  }
  return (
    <section aria-labelledby="wyniki-narzedzi" className="rounded-2xl border border-border bg-[color:var(--card-strong)] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="wyniki-narzedzi" className="font-display text-xl font-bold text-foreground">Wyniki narzędzi</h2>
        <Link href="/narzedzia" className="text-sm font-semibold text-accent hover:underline">Otwórz narzędzia</Link>
      </div>
      {results.length === 0 ? (
        <p className="mt-2 text-sm text-foreground/60">
          Nic jeszcze nie zapisano. Sprawdź ceny w okolicy, przeczytaj księgę albo zrób protokół i kliknij „Zapisz na karcie”.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {results.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-foreground">{r.title}</p>
                <p className="font-mono text-xs text-foreground/50">{getTool(r.toolId)?.name ?? r.toolId} · {dataPl(r.createdAt)}</p>
              </div>
              <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/70">
                {Object.entries(r.summary).map(([k, v]) => (
                  <div key={k} className="flex gap-1">
                    <dt>{k}:</dt>
                    <dd className="font-mono">{typeof v === 'number' ? v.toLocaleString('pl-PL') : v}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
