'use client'

import { useMemo, useState } from 'react'
import SaveToFolder, { type SavePayload } from '@/components/tools/SaveToFolder'
import { DZIALY, PRZYKLAD, analizuj, type DzialId, type Waga } from './domain'

const KOLOR: Record<Waga, string> = {
  ok: 'border-[#4f7a3a]/40 bg-[#4f7a3a]/10 text-[#2f4a22]',
  uwaga: 'border-[#b26a00]/40 bg-[#b26a00]/10 text-[#6b4000]',
  ryzyko: 'border-[#b3261e]/40 bg-[#b3261e]/10 text-[#7a1712]',
}
const NAZWA: Record<Waga, string> = { ok: 'w porządku', uwaga: 'sprawdź', ryzyko: 'ryzyko' }
const card = 'rounded-2xl border border-border bg-[color:var(--card-strong)] p-5'

export default function KsiegaApp({ mode }: { mode: 'platform' | 'public' }) {
  const [tekst, setTekst] = useState('')
  const [przyklad, setPrzyklad] = useState(false)
  const a = useMemo(() => (tekst.trim().length > 20 ? analizuj(tekst) : null), [tekst])

  const payload: SavePayload | null =
    a && !przyklad
      ? {
          toolId: 'ksiega-wieczysta',
          title: `Księga ${a.numer ?? 'bez numeru'}`,
          summary: {
            ...(a.numer ? { 'numer księgi': a.numer } : {}),
            właściciele: a.wlasciciele.length,
            hipoteki: a.hipoteki.length,
            ryzyka: a.flagi.filter((f) => f.waga === 'ryzyko').length,
            'do sprawdzenia': a.flagi.filter((f) => f.waga === 'uwaga').length,
          },
        }
      : null

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <section className={card}>
          <h2 className="font-display text-lg font-bold">Wklej treść księgi</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground/70">
            <li>Otwórz <a className="font-semibold text-accent underline" href="https://przegladarka-ekw.ms.gov.pl" target="_blank" rel="noopener noreferrer">przeglądarkę ksiąg wieczystych</a> i wpisz numer księgi.</li>
            <li>Wybierz „Przeglądanie aktualnej treści KW”.</li>
            <li>W każdym dziale zaznacz wszystko (Ctrl+A albo Cmd+A), skopiuj i wklej tutaj, dział pod działem.</li>
          </ol>
          <label htmlFor="kw-tekst" className="sr-only">Treść księgi wieczystej</label>
          <textarea id="kw-tekst" rows={12} value={tekst} onChange={(e) => { setTekst(e.target.value); setPrzyklad(false) }}
            placeholder="DZIAŁ I-O - OZNACZENIE NIERUCHOMOŚCI ..."
            className="mt-3 w-full rounded-lg border border-border bg-background p-3 font-mono text-xs" />
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <button type="button" className="font-semibold text-accent" onClick={() => { setTekst(PRZYKLAD); setPrzyklad(true) }}>Wczytaj przykład</button>
            <button type="button" className="font-semibold text-foreground/60" onClick={() => { setTekst(''); setPrzyklad(false) }}>Wyczyść</button>
          </div>
          <p className="mt-3 text-xs text-foreground/50">Treść księgi zostaje w Twojej przeglądarce. Nie wysyłamy jej na serwer i nie używamy AI. Rozpoznanie robią stałe reguły.</p>
        </section>
        {a && <SaveToFolder payload={payload} mode={mode} />}
      </div>

      <div className="min-w-0 space-y-4">
        {!a ? (
          <section className={card}>
            <p className="text-sm text-foreground/60">Po wklejeniu treści zobaczysz tu właścicieli, obciążenia, hipoteki i listę pytań do sprzedającego.</p>
          </section>
        ) : (
          <>
            {przyklad && <p className="rounded-lg bg-[color:var(--slate-light)] px-4 py-2 text-sm">To przykładowa księga ze zmyślonymi danymi.</p>}
            <section className={card}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl font-bold">{a.lokal.adres ?? 'Lokal'}</h2>
                <span className="font-mono text-sm">{a.numer ?? 'numer księgi nierozpoznany'}</span>
              </div>
              <p className="mt-1 text-sm text-foreground/60">
                {[a.lokal.przeznaczenie, a.lokal.powierzchnia].filter(Boolean).join(' · ') || 'Brak opisu lokalu w dziale I-O.'}
              </p>
              {a.brakujaceDzialy.length > 0 && (
                <p className="mt-2 text-sm text-[#6b4000]">Brakuje działów: {a.brakujaceDzialy.map((d) => `${d} (${DZIALY[d]})`).join(', ')}. Wklej je, żeby ocena była pełna.</p>
              )}
            </section>

            <section className="space-y-2">
              {a.flagi.map((f, i) => (
                <div key={i} className={`rounded-xl border p-4 ${KOLOR[f.waga]}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase ring-1 ring-current">{NAZWA[f.waga]}</span>
                    <span className="text-xs font-semibold opacity-70">{f.dzial === 'wzmianki' ? 'Wzmianki' : `Dział ${f.dzial}`}</span>
                  </div>
                  <p className="mt-1 font-semibold">{f.tytul}</p>
                  <p className="text-sm">{f.poLudzku}</p>
                </div>
              ))}
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <section className={card}>
                <h3 className="font-display text-lg font-bold">Właściciele</h3>
                {a.wlasciciele.length === 0 ? <p className="mt-2 text-sm text-foreground/60">Nie rozpoznano. Sprawdź dział II.</p> : (
                  <ul className="mt-2 space-y-1 text-sm">{a.wlasciciele.map((w, i) => <li key={i}>{w.nazwa}{w.udzial ? <span className="font-mono text-foreground/60"> · udział {w.udzial}</span> : ''}</li>)}</ul>
                )}
              </section>
              <section className={card}>
                <h3 className="font-display text-lg font-bold">Hipoteki</h3>
                {a.hipoteki.length === 0 ? <p className="mt-2 text-sm text-foreground/60">Brak.</p> : (
                  <ul className="mt-2 space-y-1 text-sm">{a.hipoteki.map((h, i) => <li key={i}><span className="font-mono">{h.suma ?? 'kwota nierozpoznana'} {h.waluta ?? ''}</span>{h.wierzyciel ? `, ${h.wierzyciel}` : ''}</li>)}</ul>
                )}
              </section>
            </div>

            <section className={card}>
              <h3 className="font-display text-lg font-bold">Zapytaj sprzedającego</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{a.pytania.map((q) => <li key={q}>{q}</li>)}</ol>
            </section>

            <section className={card}>
              <h3 className="font-display text-lg font-bold">Treść działów</h3>
              {(Object.keys(DZIALY) as DzialId[]).filter((d) => a.tekstDzialow[d]).map((d) => (
                <details key={d} className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold">Dział {d}: {DZIALY[d]}</summary>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-background p-3 font-mono text-xs">{a.tekstDzialow[d]}</pre>
                </details>
              ))}
            </section>
            <p className="text-xs text-foreground/50">Wynik pochodzi z automatycznego rozpoznania tekstu. Porównaj go z oryginałem księgi. Przed zakupem księgę ocenia notariusz albo prawnik. To nie jest porada prawna.</p>
          </>
        )}
      </div>
    </div>
  )
}
