'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SaveToFolder, { type SavePayload } from '@/components/tools/SaveToFolder'
import {
  STANY,
  gotowyDoPodpisu,
  newId,
  nowyProtokol,
  podpisany,
  porownaj,
  rozliczKaucje,
  zwrotZWydania,
  type Protokol,
  type Stan,
} from './domain'
import ProtokolDokument from './ProtokolDokument'
import SignaturePad from './SignaturePad'
import { eksportuj, importuj, listaProtokolow, usunProtokol, zapiszProtokol, zmniejszZdjecie } from './storage'

const input = 'min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm'
const label = 'text-xs font-semibold text-foreground/60'
const card = 'rounded-2xl border border-border bg-[color:var(--card-strong)] p-5'
const btn = 'min-h-11 rounded-full px-5 text-sm font-semibold'
const pl = (iso: string) => iso.split('-').reverse().join('.')
const TYP: Record<Protokol['typ'], string> = { wydanie: 'wydania', zwrot: 'zwrotu' }

type Krok = 'dane' | 'liczniki' | 'pokoje' | 'klucze' | 'rozliczenie' | 'podpisy' | 'gotowe'

export default function ProtokolApp({ mode }: { mode: 'platform' | 'public' }) {
  const [lista, setLista] = useState<Protokol[] | null>(null)
  const [p, setP] = useState<Protokol | null>(null)
  const [krok, setKrok] = useState<Krok>('dane')
  const [blad, setBlad] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const odswiez = useCallback(async () => {
    try {
      setLista(await listaProtokolow())
    } catch {
      setLista([])
      setBlad('Ta przeglądarka nie pozwala zapisywać protokołów. Wyłącz tryb prywatny.')
    }
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => void odswiez())
    return () => cancelAnimationFrame(frame)
  }, [odswiez])

  // autozapis na urządzeniu
  useEffect(() => {
    if (!p) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      zapiszProtokol(p).catch(() => setBlad('Nie udało się zapisać na urządzeniu. Za mało miejsca?'))
    }, 400)
  }, [p])

  const kroki: Array<{ id: Krok; nazwa: string }> = useMemo(
    () => [
      { id: 'dane', nazwa: 'Dane' },
      { id: 'liczniki', nazwa: 'Liczniki' },
      { id: 'pokoje', nazwa: 'Pokoje' },
      { id: 'klucze', nazwa: 'Klucze' },
      ...(p?.typ === 'zwrot' ? [{ id: 'rozliczenie' as Krok, nazwa: 'Porównanie i kaucja' }] : []),
      { id: 'podpisy', nazwa: 'Podpisy' },
      { id: 'gotowe', nazwa: 'Gotowe' },
    ],
    [p?.typ],
  )

  if (!p) {
    const wydania = (lista ?? []).filter((x) => x.typ === 'wydanie')
    return (
      <div className="space-y-6">
        {blad && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{blad}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <section className={card}>
            <h2 className="font-display text-lg font-bold">Wydanie mieszkania</h2>
            <p className="mt-1 text-sm text-foreground/60">Na początku najmu. Spisz liczniki, stan pokoi, klucze i podpiszcie oboje.</p>
            <button type="button" className={`${btn} mt-4 bg-accent text-white`} onClick={() => { setP(nowyProtokol('wydanie')); setKrok('dane') }}>
              Nowy protokół wydania
            </button>
          </section>
          <section className={card}>
            <h2 className="font-display text-lg font-bold">Zwrot mieszkania</h2>
            <p className="mt-1 text-sm text-foreground/60">Przy wyprowadzce. Zaczynasz od protokołu wydania i od razu widzisz, co się zmieniło.</p>
            {wydania.length > 0 ? (
              <div className="mt-4 space-y-2">
                {wydania.map((w) => (
                  <button key={w.id} type="button" className={`${btn} w-full border border-border text-left`} onClick={() => { setP(zwrotZWydania(w)); setKrok('dane') }}>
                    Zwrot do wydania z {pl(w.data)}{w.adres ? `, ${w.adres}` : ''}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-foreground/60">Brak wydań na tym urządzeniu. Wczytaj plik protokołu wydania poniżej.</p>
            )}
          </section>
        </div>

        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold">Protokoły na tym urządzeniu</h2>
            <label className={`${btn} inline-flex cursor-pointer items-center border border-border`}>
              Wczytaj z pliku
              <input type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                try {
                  const imp = await importuj(f)
                  await zapiszProtokol(imp)
                  await odswiez()
                } catch (err) {
                  setBlad(err instanceof Error ? err.message : 'Nie udało się wczytać pliku.')
                }
              }} />
            </label>
          </div>
          {lista === null ? (
            <p className="mt-3 text-sm text-foreground/60">Wczytuję...</p>
          ) : lista.length === 0 ? (
            <p className="mt-3 text-sm text-foreground/60">Nie masz jeszcze protokołów.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {lista.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="min-w-0">
                    <b className="capitalize">{x.typ}</b> {pl(x.data)}{x.adres ? `, ${x.adres}` : ''}
                    <span className="ml-2 font-mono text-xs text-foreground/50">{podpisany(x) ? 'podpisany' : 'szkic'}</span>
                  </span>
                  <span className="flex gap-3">
                    <button type="button" className="font-semibold text-accent" onClick={() => { setP(x); setKrok(podpisany(x) ? 'gotowe' : 'dane') }}>Otwórz</button>
                    <button type="button" className="font-semibold text-foreground/70" onClick={() => eksportuj(x)}>Do pliku</button>
                    <button type="button" className="font-semibold text-red-700" onClick={async () => {
                      if (!window.confirm('Usunąć protokół z tego urządzenia? Tego nie da się cofnąć.')) return
                      await usunProtokol(x.id)
                      await odswiez()
                    }}>Usuń</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-foreground/50">Protokoły, zdjęcia i podpisy są tylko na tym urządzeniu. Żeby zrobić zwrot na innym telefonie, zapisz wydanie do pliku.</p>
        </section>
      </div>
    )
  }

  const upd = (fn: (d: Protokol) => Protokol) =>
    setP((d) => {
      if (!d) return d
      const next = fn(structuredClone(d))
      const tylkoPodpisy =
        JSON.stringify({ ...next, podpisWynajmujacego: 0, podpisNajemcy: 0 }) ===
        JSON.stringify({ ...d, podpisWynajmujacego: 0, podpisNajemcy: 0 })
      if (!tylkoPodpisy && (d.podpisWynajmujacego || d.podpisNajemcy)) {
        next.podpisWynajmujacego = undefined
        next.podpisNajemcy = undefined
      }
      return next
    })
  const idx = kroki.findIndex((k) => k.id === krok)
  const braki = gotowyDoPodpisu(p)
  const cmp = p.typ === 'zwrot' && p.wydanie ? porownaj(p.wydanie, p) : null
  const kaucja = p.typ === 'zwrot' ? rozliczKaucje(p.kaucja, p.potracenia) : null
  const zdjec = p.pokoje.reduce((s, r) => s + r.elementy.reduce((t, e) => t + e.zdjecia.length, 0), 0)

  const payload: SavePayload | null = podpisany(p)
    ? {
        toolId: 'protokol',
        title: `Protokół ${TYP[p.typ]} ${pl(p.data)}`,
        summary: {
          typ: p.typ,
          data: p.data,
          pomieszczenia: p.pokoje.length,
          zdjęcia: zdjec,
          ...(cmp ? { 'nowe szkody': cmp.noweSzkody.length } : {}),
          ...(kaucja ? { 'kaucja do zwrotu zł': kaucja.doZwrotu, 'dopłata zł': kaucja.doplata } : {}),
        },
      }
    : null

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="text-sm font-semibold text-foreground/70 hover:text-accent" onClick={() => { setP(null); void odswiez() }}>
          Wszystkie protokoły
        </button>
        <p className="font-mono text-xs text-foreground/50">Protokół {TYP[p.typ]} · {pl(p.data)} · zapisano na urządzeniu</p>
      </div>
      <nav aria-label="Kroki protokołu" className="no-print flex gap-2 overflow-x-auto pb-1">
        {kroki.map((k, i) => (
          <button key={k.id} type="button" onClick={() => setKrok(k.id)} aria-current={k.id === krok ? 'step' : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold ${k.id === krok ? 'border-accent bg-accent text-white' : 'border-border text-foreground/70'}`}>
            <span className="font-mono">{i + 1}</span> {k.nazwa}
          </button>
        ))}
      </nav>
      {blad && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{blad}</p>}

      {krok === 'dane' && (
        <section className={`${card} space-y-3`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="p-data" className={label}>Data</label><input id="p-data" type="date" className={input} value={p.data} onChange={(e) => upd((d) => ({ ...d, data: e.target.value }))} /></div>
            <div><label htmlFor="p-adres" className={label}>Adres mieszkania</label><input id="p-adres" className={input} value={p.adres} onChange={(e) => upd((d) => ({ ...d, adres: e.target.value }))} /></div>
            <div><label htmlFor="p-wyn" className={label}>Wynajmujący</label><input id="p-wyn" className={input} value={p.wynajmujacy} onChange={(e) => upd((d) => ({ ...d, wynajmujacy: e.target.value }))} /></div>
            <div><label htmlFor="p-naj" className={label}>Najemca</label><input id="p-naj" className={input} value={p.najemca} onChange={(e) => upd((d) => ({ ...d, najemca: e.target.value }))} /></div>
            <div><label htmlFor="p-kaucja" className={label}>Kaucja zł (opcjonalnie)</label><input id="p-kaucja" inputMode="decimal" className={input} value={p.kaucja ?? ''} onChange={(e) => upd((d) => ({ ...d, kaucja: Number(e.target.value.replace(',', '.')) || undefined }))} /></div>
          </div>
        </section>
      )}

      {krok === 'liczniki' && (
        <section className={`${card} space-y-4`}>
          {p.liczniki.map((l, i) => (
            <div key={l.id} className="grid gap-3 border-b border-border pb-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
              <div><label htmlFor={`l-r-${l.id}`} className={label}>Licznik</label><input id={`l-r-${l.id}`} className={input} value={l.rodzaj} onChange={(e) => upd((d) => { d.liczniki[i].rodzaj = e.target.value; return d })} /></div>
              <div><label htmlFor={`l-n-${l.id}`} className={label}>Numer licznika</label><input id={`l-n-${l.id}`} className={input} value={l.numer} onChange={(e) => upd((d) => { d.liczniki[i].numer = e.target.value; return d })} /></div>
              <div>
                <label htmlFor={`l-s-${l.id}`} className={label}>Stan{cmp ? ` (przy wydaniu: ${cmp.liczniki.find((x) => x.rodzaj === l.rodzaj)?.przed ?? 'brak'})` : ''}</label>
                <input id={`l-s-${l.id}`} inputMode="decimal" className={`${input} font-mono`} value={l.stan} onChange={(e) => upd((d) => { d.liczniki[i].stan = e.target.value; return d })} />
              </div>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer text-sm font-semibold text-accent">
                  {l.zdjecie ? 'Zmień zdjęcie' : 'Zdjęcie tarczy'}
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={async (e) => {
                    const f = e.target.files?.[0]; e.target.value = ''
                    if (!f) return
                    const z = await zmniejszZdjecie(f)
                    upd((d) => { d.liczniki[i].zdjecie = z; return d })
                  }} />
                </label>
                <button type="button" className="text-sm text-red-700" onClick={() => upd((d) => { d.liczniki.splice(i, 1); return d })}>Usuń</button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {l.zdjecie && <img src={l.zdjecie} alt={`Tarcza: ${l.rodzaj}`} className="h-24 rounded-lg object-cover sm:col-span-4" />}
            </div>
          ))}
          <button type="button" className={`${btn} border border-border`} onClick={() => upd((d) => { d.liczniki.push({ id: newId('l'), rodzaj: 'Ciepło', numer: '', stan: '' }); return d })}>Dodaj licznik</button>
        </section>
      )}

      {krok === 'pokoje' && (
        <div className="space-y-4">
          {p.pokoje.map((r, ri) => (
            <section key={r.id} className={`${card} space-y-3`}>
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor={`r-${r.id}`} className="sr-only">Nazwa pomieszczenia</label>
                <input id={`r-${r.id}`} className={`${input} max-w-xs font-display font-bold`} value={r.nazwa} onChange={(e) => upd((d) => { d.pokoje[ri].nazwa = e.target.value; return d })} />
                <button type="button" className="text-sm text-red-700" onClick={() => { if (window.confirm(`Usunąć pomieszczenie ${r.nazwa}?`)) upd((d) => { d.pokoje.splice(ri, 1); return d }) }}>Usuń pomieszczenie</button>
              </div>
              {r.elementy.map((e, ei) => {
                const c = cmp?.elementy.find((x) => x.pokoj === r.nazwa && x.element === e.nazwa)
                return (
                  <div key={e.id} className="grid gap-2 border-t border-border pt-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                    <div>
                      <p className="text-sm font-semibold">{e.nazwa}</p>
                      {c && <p className="text-xs text-foreground/60">Przy wydaniu: {c.przed}{c.ocena !== 'bez zmian' ? ` · ${c.ocena}` : ''}</p>}
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Stan: ${e.nazwa}`}>
                        {STANY.map((s) => (
                          <button key={s.value} type="button" role="radio" aria-checked={e.stan === s.value}
                            onClick={() => upd((d) => { d.pokoje[ri].elementy[ei].stan = s.value as Stan; return d })}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${e.stan === s.value ? 'border-accent bg-accent text-white' : 'border-border text-foreground/70'}`}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                      <label htmlFor={`u-${e.id}`} className="sr-only">Uwagi: {e.nazwa}</label>
                      <input id={`u-${e.id}`} className={input} placeholder="Uwagi, np. rysa na drzwiach przy klamce (możesz dyktować z klawiatury)" value={e.uwagi} onChange={(ev) => upd((d) => { d.pokoje[ri].elementy[ei].uwagi = ev.target.value; return d })} />
                      <div className="flex flex-wrap items-center gap-2">
                        {e.zdjecia.map((z, zi) => (
                          <button key={zi} type="button" title="Usuń zdjęcie" onClick={() => upd((d) => { d.pokoje[ri].elementy[ei].zdjecia.splice(zi, 1); return d })}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={z} alt={`${r.nazwa}: ${e.nazwa}, zdjęcie ${zi + 1}`} className="h-16 w-16 rounded-lg object-cover" />
                          </button>
                        ))}
                        <label className="cursor-pointer rounded-lg border border-dashed border-border px-3 py-2 text-xs font-semibold text-accent">
                          Dodaj zdjęcie
                          <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={async (ev) => {
                            const files = Array.from(ev.target.files ?? []); ev.target.value = ''
                            const nowe: string[] = []
                            for (const f of files) nowe.push(await zmniejszZdjecie(f))
                            upd((d) => { d.pokoje[ri].elementy[ei].zdjecia.push(...nowe); return d })
                          }} />
                        </label>
                      </div>
                    </div>
                  </div>
                )
              })}
              <button type="button" className="text-sm font-semibold text-accent" onClick={() => {
                const nazwa = window.prompt('Nazwa elementu, np. Balkon')
                if (nazwa?.trim()) upd((d) => { d.pokoje[ri].elementy.push({ id: newId('e'), nazwa: nazwa.trim(), stan: 'dobry', uwagi: '', zdjecia: [] }); return d })
              }}>Dodaj element</button>
            </section>
          ))}
          <button type="button" className={`${btn} border border-border`} onClick={() => upd((d) => { d.pokoje.push({ id: newId('p'), nazwa: 'Nowe pomieszczenie', elementy: ['Ściany i sufit', 'Podłoga', 'Okna i parapety'].map((nazwa) => ({ id: newId('e'), nazwa, stan: 'dobry' as Stan, uwagi: '', zdjecia: [] })) }); return d })}>Dodaj pomieszczenie</button>
        </div>
      )}

      {krok === 'klucze' && (
        <section className={`${card} space-y-3`}>
          {p.klucze.map((k, i) => (
            <div key={k.id} className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-end gap-3">
              <div><label htmlFor={`k-${k.id}`} className={label}>Klucz, pilot, karta</label><input id={`k-${k.id}`} className={input} value={k.nazwa} onChange={(e) => upd((d) => { d.klucze[i].nazwa = e.target.value; return d })} /></div>
              <div><label htmlFor={`kn-${k.id}`} className={label}>Sztuk</label><input id={`kn-${k.id}`} inputMode="numeric" className={`${input} font-mono`} value={k.ilosc} onChange={(e) => upd((d) => { d.klucze[i].ilosc = Math.max(0, parseInt(e.target.value || '0', 10) || 0); return d })} /></div>
              <button type="button" className="min-h-11 text-sm text-red-700" onClick={() => upd((d) => { d.klucze.splice(i, 1); return d })}>Usuń</button>
            </div>
          ))}
          <button type="button" className={`${btn} border border-border`} onClick={() => upd((d) => { d.klucze.push({ id: newId('k'), nazwa: 'Pilot do bramy', ilosc: 1 }); return d })}>Dodaj</button>
          <div><label htmlFor="p-uwagi" className={label}>Uwagi ogólne</label><textarea id="p-uwagi" rows={3} className={`${input} py-2`} value={p.uwagi} onChange={(e) => upd((d) => ({ ...d, uwagi: e.target.value }))} /></div>
        </section>
      )}

      {krok === 'rozliczenie' && cmp && kaucja && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className={card}>
            <h2 className="font-display text-lg font-bold">Co się zmieniło od wydania</h2>
            {cmp.elementy.filter((e) => e.ocena !== 'bez zmian').length === 0 ? (
              <p className="mt-2 text-sm text-foreground/60">Bez zmian względem wydania.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {cmp.elementy.filter((e) => e.ocena !== 'bez zmian').map((e) => (
                  <li key={`${e.pokoj}-${e.element}`}>
                    <span className={`mr-2 rounded px-1.5 py-0.5 font-mono text-[0.65rem] uppercase ${e.ocena === 'nowa szkoda' ? 'bg-red-100 text-red-800' : 'bg-[color:var(--slate-light)]'}`}>{e.ocena}</span>
                    {e.pokoj}: {e.element}{e.uwagi ? `, ${e.uwagi}` : ''}
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mt-4 font-semibold">Liczniki</h3>
            <ul className="mt-1 font-mono text-sm">{cmp.liczniki.map((l) => <li key={l.rodzaj}>{l.rodzaj}: {l.zuzycie ?? 'brak odczytu'}</li>)}</ul>
            {cmp.klucze.some((k) => k.brakuje) && <p className="mt-3 text-sm text-red-700">Brakuje kluczy: {cmp.klucze.filter((k) => k.brakuje).map((k) => `${k.nazwa} (${k.brakuje})`).join(', ')}</p>}
            <p className="mt-3 text-xs text-foreground/50">Ocena wynika ze stanów wpisanych przy wydaniu i zwrocie. O tym, co jest zwykłym zużyciem, decydujecie wspólnie.</p>
          </section>
          <section className={`${card} space-y-3`}>
            <h2 className="font-display text-lg font-bold">Rozliczenie kaucji</h2>
            <p className="text-sm">Kaucja: <b className="font-mono">{kaucja.kaucja.toFixed(2)} zł</b></p>
            {p.potracenia.map((x, i) => (
              <div key={x.id} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-end gap-2">
                <div><label htmlFor={`pt-${x.id}`} className={label}>Potrącenie</label><input id={`pt-${x.id}`} className={input} value={x.opis} onChange={(e) => upd((d) => { d.potracenia[i].opis = e.target.value; return d })} /></div>
                <div><label htmlFor={`ptk-${x.id}`} className={label}>zł</label><input id={`ptk-${x.id}`} inputMode="decimal" className={`${input} font-mono`} value={x.kwota || ''} onChange={(e) => upd((d) => { d.potracenia[i].kwota = Number(e.target.value.replace(',', '.')) || 0; return d })} /></div>
                <button type="button" className="min-h-11 text-sm text-red-700" onClick={() => upd((d) => { d.potracenia.splice(i, 1); return d })}>Usuń</button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`${btn} border border-border`} onClick={() => upd((d) => { d.potracenia.push({ id: newId('pt'), opis: '', kwota: 0 }); return d })}>Dodaj potrącenie</button>
              {cmp.noweSzkody.length > 0 && (
                <button type="button" className={`${btn} border border-border`} onClick={() => upd((d) => { for (const s of cmp.noweSzkody) d.potracenia.push({ id: newId('pt'), opis: `${s.pokoj}: ${s.element}`, kwota: 0 }); return d })}>Dodaj nowe szkody jako pozycje</button>
              )}
            </div>
            <p className="text-base font-semibold">{kaucja.doplata > 0 ? `Najemca dopłaca ${kaucja.doplata.toFixed(2)} zł` : `Do zwrotu najemcy ${kaucja.doZwrotu.toFixed(2)} zł`}</p>
            <p className="text-xs text-foreground/50">Kaucję zwraca się w ciągu miesiąca od opróżnienia lokalu, po potrąceniu należności.</p>
          </section>
        </div>
      )}

      {krok === 'podpisy' && (
        <section className={`${card} space-y-4`}>
          {braki.length > 0 ? (
            <p className="text-sm text-red-700">Przed podpisem uzupełnij: {braki.join(', ')}.</p>
          ) : (
            <>
              <p className="text-sm text-foreground/60">Przejrzyjcie protokół w kroku Gotowe, potem podpiszcie palcem. Po zmianie treści podpisy trzeba złożyć ponownie.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <SignaturePad label="Wynajmujący" value={p.podpisWynajmujacego} onChange={(v) => upd((d) => ({ ...d, podpisWynajmujacego: v }))} />
                <SignaturePad label="Najemca" value={p.podpisNajemcy} onChange={(v) => upd((d) => ({ ...d, podpisNajemcy: v }))} />
              </div>
            </>
          )}
        </section>
      )}

      {krok === 'gotowe' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <ProtokolDokument p={p} />
          <aside className="no-print space-y-3">
            <button type="button" className={`${btn} w-full bg-accent text-white`} onClick={() => window.print()}>Drukuj albo zapisz PDF</button>
            <button type="button" className={`${btn} w-full border border-border`} onClick={() => eksportuj(p)}>Zapisz do pliku</button>
            <p className="text-xs text-foreground/50">PDF wyślij drugiej stronie sam, mailem albo komunikatorem. Plik przyda się przy zwrocie na innym telefonie.</p>
            {!podpisany(p) && <p className="text-xs text-red-700">Brakuje podpisów obu stron.</p>}
            <SaveToFolder payload={payload} mode={mode} />
          </aside>
        </div>
      )}

      <div className="no-print flex justify-between gap-3">
        <button type="button" disabled={idx <= 0} className={`${btn} border border-border disabled:opacity-40`} onClick={() => setKrok(kroki[idx - 1].id)}>Wstecz</button>
        <button type="button" disabled={idx >= kroki.length - 1} className={`${btn} bg-accent text-white disabled:opacity-40`} onClick={() => setKrok(kroki[idx + 1].id)}>Dalej</button>
      </div>
    </div>
  )
}
