'use client'

import { useMemo, useState } from 'react'
import SaveToFolder, { type SavePayload } from '@/components/tools/SaveToFolder'
import type { Estimate, RcnSummary, Transaction } from '@/features/rejestr/domain'
import powiatyData from '@/features/rejestr/powiaty.json'

type Result = {
  nazwa: string
  od?: string
  daneDo?: string
  liczba: number
  podsumowanie: RcnSummary | null
  dzielnice: Array<{ nazwa: string } & RcnSummary>
  miesiace: Array<{ mies: string } & RcnSummary>
  wycena: Estimate | null
  transakcje: Transaction[]
}

const zl = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 })
const fmt = (n: number | null | undefined) => (typeof n === 'number' ? zl.format(n) : 'brak')

const powiaty = (powiatyData as { powiaty: Array<{ teryt: string; nazwa: string; woj: string }> }).powiaty
  .slice()
  .sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'))

export default function RejestrClient() {
  const [teryt, setTeryt] = useState('2261')
  const [mies, setMies] = useState('12')
  const [dzielnica, setDzielnica] = useState('')
  const [metraz, setMetraz] = useState('')
  const [rynek, setRynek] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)

  async function search(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setError('')
    const q = new URLSearchParams({ teryt, mies })
    if (dzielnica) q.set('dzielnica', dzielnica)
    if (metraz) q.set('metraz', metraz)
    if (rynek) q.set('rynek', rynek)
    try {
      const res = await fetch(`/api/narzedzia/rejestr?${q}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Nie udało się pobrać danych.')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać danych.')
    } finally {
      setLoading(false)
    }
  }

  const payload: SavePayload | null = useMemo(() => {
    if (!result?.podsumowanie) return null
    const s: Record<string, string | number> = {
      obszar: result.nazwa,
      okres: `${mies} mies.`,
      transakcje: result.podsumowanie.liczba,
      'mediana zł/m²': result.podsumowanie.mediana,
    }
    if (dzielnica) s.dzielnica = dzielnica
    if (result.wycena) {
      s['podobne transakcje'] = result.wycena.podobne
      s['mediana podobnych zł/m²'] = result.wycena.medianaM2
      if (result.wycena.wartosc) {
        s['metraż m²'] = Number(metraz)
        s['wartość szacunkowa zł'] = result.wycena.wartosc
        s['widełki zł'] = `${fmt(result.wycena.wartoscOd)} do ${fmt(result.wycena.wartoscDo)}`
      }
    }
    return { toolId: 'rejestr-cen', title: `Ceny: ${result.nazwa}${dzielnica ? `, ${dzielnica}` : ''}`, summary: s }
  }, [result, mies, dzielnica, metraz])

  const input = 'min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm'

  return (
    <div className="space-y-6">
      <form onSubmit={search} className="grid gap-3 rounded-2xl border border-border bg-[color:var(--card-strong)] p-5 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label htmlFor="rcn-powiat" className="text-xs font-semibold text-foreground/60">Powiat albo miasto</label>
          <select id="rcn-powiat" value={teryt} onChange={(e) => { setTeryt(e.target.value); setDzielnica(''); setResult(null) }} className={input}>
            {powiaty.map((p) => (
              <option key={p.teryt} value={p.teryt}>{p.nazwa} ({p.woj})</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rcn-mies" className="text-xs font-semibold text-foreground/60">Okres</label>
          <select id="rcn-mies" value={mies} onChange={(e) => setMies(e.target.value)} className={input}>
            {['3', '6', '12', '24', '36'].map((m) => <option key={m} value={m}>{m} mies.</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="rcn-dz" className="text-xs font-semibold text-foreground/60">Dzielnica</label>
          <select id="rcn-dz" value={dzielnica} onChange={(e) => setDzielnica(e.target.value)} className={input} disabled={!result}>
            <option value="">{result ? 'wszystkie' : 'najpierw szukaj'}</option>
            {result?.dzielnice.map((d) => <option key={d.nazwa} value={d.nazwa}>{d.nazwa}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="rcn-m2" className="text-xs font-semibold text-foreground/60">Metraż m²</label>
          <input id="rcn-m2" inputMode="decimal" value={metraz} onChange={(e) => setMetraz(e.target.value.replace(',', '.'))} className={input} placeholder="np. 48" />
        </div>
        <div>
          <label htmlFor="rcn-rynek" className="text-xs font-semibold text-foreground/60">Rynek</label>
          <select id="rcn-rynek" value={rynek} onChange={(e) => setRynek(e.target.value)} className={input}>
            <option value="">oba</option>
            <option value="wtórny">wtórny</option>
            <option value="pierwotny">pierwotny</option>
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-6 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={loading} className="min-h-11 rounded-full bg-accent px-6 text-sm font-semibold text-white disabled:opacity-50">
            {loading ? 'Pobieram z urzędu, to trwa do minuty...' : result ? 'Przelicz' : 'Pokaż ceny'}
          </button>
          <p className="text-xs text-foreground/50">Dane z aktów notarialnych w rejestrze cen powiatu.</p>
        </div>
      </form>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {result && result.podsumowanie && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-6">
            <section className="grid gap-3 sm:grid-cols-4">
              <Tile label="transakcje" value={fmt(result.podsumowanie.liczba)} />
              <Tile label="mediana zł/m²" value={fmt(result.podsumowanie.mediana)} />
              <Tile label="25% taniej niż" value={fmt(result.podsumowanie.p25)} />
              <Tile label="25% drożej niż" value={fmt(result.podsumowanie.p75)} />
            </section>
            <p className="text-xs text-foreground/50">
              {result.nazwa}. Dane od {result.od ?? 'brak'} do {result.daneDo ?? 'brak'}.
            </p>

            <section className="rounded-2xl border border-border bg-[color:var(--card-strong)] p-5">
              <h2 className="font-display text-lg font-bold">Twoje mieszkanie</h2>
              {result.wycena ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p>
                    Podobne transakcje: <b className="font-mono">{result.wycena.podobne}</b> ({result.wycena.zakres}
                    {dzielnica ? `, ${dzielnica}` : ''}).
                  </p>
                  <p>
                    Mediana: <b className="font-mono">{fmt(result.wycena.medianaM2)} zł/m²</b>, środkowa połowa od{' '}
                    {fmt(result.wycena.p25M2)} do {fmt(result.wycena.p75M2)} zł/m².
                  </p>
                  {result.wycena.wartosc ? (
                    <p className="text-base">
                      Szacunkowa wartość: <b className="font-mono text-accent">{fmt(result.wycena.wartosc)} zł</b>
                      <span className="text-foreground/60"> (od {fmt(result.wycena.wartoscOd)} do {fmt(result.wycena.wartoscDo)} zł)</span>
                    </p>
                  ) : (
                    <p className="text-foreground/60">Wpisz metraż, a policzymy wartość.</p>
                  )}
                  <p className="text-xs text-foreground/50">
                    To szacunek z cen transakcyjnych, nie operat szacunkowy rzeczoznawcy.
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-foreground/60">
                  Za mało podobnych transakcji. Wybierz szerszy okres albo inną dzielnicę.
                </p>
              )}
            </section>

            <section className="overflow-x-auto rounded-2xl border border-border bg-[color:var(--card-strong)]">
              <table className="w-full text-sm">
                <caption className="p-4 text-left font-display text-lg font-bold">Ostatnie transakcje</caption>
                <thead className="text-left text-xs uppercase tracking-wide text-foreground/50">
                  <tr><th className="px-4 py-2">Data</th><th className="px-4 py-2">Dzielnica</th><th className="px-4 py-2">Ulica</th><th className="px-4 py-2 text-right">m²</th><th className="px-4 py-2 text-right">Cena</th><th className="px-4 py-2 text-right">zł/m²</th></tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {result.transakcje.map((t, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2">{t.data}</td>
                      <td className="px-4 py-2 font-sans">{t.dzielnica ?? 'brak'}</td>
                      <td className="px-4 py-2 font-sans">{t.ulica ?? 'brak'}</td>
                      <td className="px-4 py-2 text-right">{t.powierzchnia ?? 'brak'}</td>
                      <td className="px-4 py-2 text-right">{fmt(t.cena)}</td>
                      <td className="px-4 py-2 text-right">{fmt(t.cenaM2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
          <aside className="space-y-4">
            <SaveToFolder payload={payload} mode="platform" />
            <div className="rounded-xl border border-border bg-[color:var(--card-strong)] p-4 text-sm">
              <p className="font-semibold">Dzielnice</p>
              <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto font-mono text-xs">
                {result.dzielnice.map((d) => (
                  <li key={d.nazwa} className="flex justify-between gap-2">
                    <span className="truncate font-sans">{d.nazwa}</span>
                    <span>{fmt(d.mediana)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-[color:var(--card-strong)] px-4 py-3">
      <p className="text-[0.65rem] uppercase tracking-[0.12em] text-foreground/50">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
