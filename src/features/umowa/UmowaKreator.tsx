'use client'

import { useEffect, useMemo, useState } from 'react'
import SaveToFolder, { type SavePayload } from '@/components/tools/SaveToFolder'
import {
  ZALACZNIKI,
  emptyDraft,
  gotowa,
  parseAmount,
  sprawdz,
  terminZgloszenia,
  type Strona,
  type UmowaDraft,
} from './domain'

const KEY = 'umowa-najmu-okazjonalnego:szkic'
const input = 'min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm'
const label = 'text-xs font-semibold text-foreground/60'
const pl = (iso: string) => (iso ? iso.split('-').reverse().join('.') : '................')
const kw = (v: string) => {
  const n = parseAmount(v)
  return n ? `${n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł` : '................ zł'
}
const dots = (v: string) => (v.trim() ? v : '................................')

export default function UmowaKreator({ mode }: { mode: 'platform' | 'public' }) {
  const [draft, setDraft] = useState<UmowaDraft>(() => emptyDraft())
  const [loaded, setLoaded] = useState(false)
  const [pokazBraki, setPokazBraki] = useState(false)

  useEffect(() => {
    // Szkic wczytujemy po pierwszym renderze, żeby HTML z serwera zgadzał się z klientem.
    const frame = requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(KEY)
        if (saved) setDraft({ ...emptyDraft(), ...JSON.parse(saved) })
      } catch {}
      setLoaded(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(KEY, JSON.stringify(draft))
    } catch {}
  }, [draft, loaded])

  const problems = useMemo(() => sprawdz(draft), [draft])
  const ready = gotowa(draft)
  const zgloszenie = terminZgloszenia(draft)

  const set = <K extends keyof UmowaDraft>(k: K, v: UmowaDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const setStrona = (k: 'wynajmujacy' | 'najemca', f: keyof Strona, v: string) =>
    setDraft((d) => ({ ...d, [k]: { ...d[k], [f]: v } }))
  const problemFor = (pole: string) => (pokazBraki ? problems.find((p) => p.pole === pole) : undefined)

  const payload: SavePayload | null = ready
    ? {
        toolId: 'umowa-najmu',
        title: `Umowa najmu okazjonalnego od ${pl(draft.dataOd)}`,
        summary: {
          'najem od': draft.dataOd,
          'najem do': draft.dataDo,
          'czynsz zł': parseAmount(draft.czynsz) ?? 0,
          'kaucja zł': parseAmount(draft.kaucja) ?? 0,
          'zgłoszenie do US do': zgloszenie ?? 'brak',
        },
      }
    : null

  function Field({ id, title, value, onChange, pole, placeholder, type = 'text' }: {
    id: string; title: string; value: string; onChange: (v: string) => void; pole?: string; placeholder?: string; type?: string
  }) {
    const problem = pole ? problemFor(pole) : undefined
    return (
      <div>
        <label htmlFor={id} className={label}>{title}</label>
        <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={input} aria-invalid={problem?.blokuje || undefined} />
        {problem && <p className={`mt-1 text-xs ${problem.blokuje ? 'text-red-700' : 'text-foreground/60'}`}>{problem.opis}</p>}
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="no-print space-y-5">
        <section className="space-y-3 rounded-2xl border border-border bg-[color:var(--card-strong)] p-5">
          <h2 className="font-display text-lg font-bold">1. Strony</h2>
          {Field({ id: 'u-w-imie', title: 'Wynajmujący: imię i nazwisko', value: draft.wynajmujacy.imieNazwisko, onChange: (v) => setStrona('wynajmujacy', 'imieNazwisko', v), pole: 'wynajmujacy.imieNazwisko' })}
          {Field({ id: 'u-w-adres', title: 'Wynajmujący: adres zamieszkania', value: draft.wynajmujacy.adres, onChange: (v) => setStrona('wynajmujacy', 'adres', v), pole: 'wynajmujacy.adres' })}
          {Field({ id: 'u-w-dok', title: 'Wynajmujący: dokument (opcjonalnie)', value: draft.wynajmujacy.dokument, onChange: (v) => setStrona('wynajmujacy', 'dokument', v), placeholder: 'seria i numer dowodu' })}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={draft.wynajmujacyBezDzialalnosci} onChange={(e) => set('wynajmujacyBezDzialalnosci', e.target.checked)} />
            <span>Wynajmujący jest osobą fizyczną i nie prowadzi działalności gospodarczej w zakresie wynajmowania lokali.</span>
          </label>
          {problemFor('wynajmujacyBezDzialalnosci') && <p className="text-xs text-red-700">{problemFor('wynajmujacyBezDzialalnosci')!.opis}</p>}
          {Field({ id: 'u-n-imie', title: 'Najemca: imię i nazwisko', value: draft.najemca.imieNazwisko, onChange: (v) => setStrona('najemca', 'imieNazwisko', v), pole: 'najemca.imieNazwisko' })}
          {Field({ id: 'u-n-adres', title: 'Najemca: adres zamieszkania', value: draft.najemca.adres, onChange: (v) => setStrona('najemca', 'adres', v), pole: 'najemca.adres' })}
          {Field({ id: 'u-n-dok', title: 'Najemca: dokument (opcjonalnie)', value: draft.najemca.dokument, onChange: (v) => setStrona('najemca', 'dokument', v), placeholder: 'seria i numer dowodu' })}
          {Field({ id: 'u-wsp', title: 'Osoby zamieszkujące z najemcą (opcjonalnie)', value: draft.wspolzamieszkujacy, onChange: (v) => set('wspolzamieszkujacy', v), placeholder: 'imiona i nazwiska, po przecinku' })}
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-[color:var(--card-strong)] p-5">
          <h2 className="font-display text-lg font-bold">2. Lokal i okres</h2>
          {Field({ id: 'u-l-adres', title: 'Adres lokalu', value: draft.lokalAdres, onChange: (v) => set('lokalAdres', v), pole: 'lokalAdres' })}
          <div className="grid grid-cols-2 gap-3">
            {Field({ id: 'u-l-pow', title: 'Powierzchnia m²', value: draft.lokalPowierzchnia, onChange: (v) => set('lokalPowierzchnia', v) })}
            {Field({ id: 'u-l-pok', title: 'Liczba pokoi', value: draft.lokalPokoje, onChange: (v) => set('lokalPokoje', v) })}
          </div>
          {Field({ id: 'u-l-wyp', title: 'Wyposażenie (opcjonalnie)', value: draft.wyposazenie, onChange: (v) => set('wyposazenie', v), placeholder: 'np. lodówka, pralka, meble kuchenne' })}
          <div className="grid grid-cols-2 gap-3">
            {Field({ id: 'u-od', title: 'Najem od', type: 'date', value: draft.dataOd, onChange: (v) => set('dataOd', v), pole: 'dataOd' })}
            {Field({ id: 'u-do', title: 'Najem do', type: 'date', value: draft.dataDo, onChange: (v) => set('dataDo', v), pole: 'dataDo' })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Field({ id: 'u-miejsce', title: 'Miejsce zawarcia', value: draft.miejsce, onChange: (v) => set('miejsce', v) })}
            {Field({ id: 'u-data', title: 'Data zawarcia', type: 'date', value: draft.dataZawarcia, onChange: (v) => set('dataZawarcia', v) })}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-[color:var(--card-strong)] p-5">
          <h2 className="font-display text-lg font-bold">3. Pieniądze</h2>
          <div className="grid grid-cols-2 gap-3">
            {Field({ id: 'u-czynsz', title: 'Czynsz miesięcznie zł', value: draft.czynsz, onChange: (v) => set('czynsz', v), pole: 'czynsz' })}
            {Field({ id: 'u-termin', title: 'Płatny do dnia', value: draft.terminPlatnosci, onChange: (v) => set('terminPlatnosci', v), pole: 'terminPlatnosci' })}
          </div>
          {Field({ id: 'u-rach', title: 'Numer rachunku', value: draft.rachunek, onChange: (v) => set('rachunek', v), pole: 'rachunek' })}
          <div>
            <label htmlFor="u-oplaty" className={label}>Opłaty poza czynszem</label>
            <textarea id="u-oplaty" value={draft.oplaty} onChange={(e) => set('oplaty', e.target.value)} rows={3} className={`${input} py-2`} />
          </div>
          {Field({ id: 'u-kaucja', title: 'Kaucja zł (najwyżej 6 czynszów)', value: draft.kaucja, onChange: (v) => set('kaucja', v), pole: 'kaucja' })}
          <div>
            <label htmlFor="u-zw" className={label}>Zwierzęta</label>
            <select id="u-zw" value={draft.zwierzeta} onChange={(e) => set('zwierzeta', e.target.value as UmowaDraft['zwierzeta'])} className={input}>
              <option value="nie">nie</option>
              <option value="tak">tak</option>
              <option value="za zgodą">za pisemną zgodą wynajmującego</option>
            </select>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-[color:var(--card-strong)] p-5">
          <h2 className="font-display text-lg font-bold">4. Lokal na wypadek eksmisji</h2>
          <p className="text-sm text-foreground/60">Najemca wskazuje inny lokal, w którym zamieszka, jeśli będzie musiał się wyprowadzić. Właściciel tego lokalu podpisuje zgodę.</p>
          {Field({ id: 'u-zast', title: 'Adres lokalu wskazanego przez najemcę', value: draft.lokalZastepczyAdres, onChange: (v) => set('lokalZastepczyAdres', v), pole: 'lokalZastepczyAdres' })}
        </section>

        <section className="rounded-2xl border border-border bg-[color:var(--card-strong)] p-5 text-sm">
          <h2 className="font-display text-lg font-bold">Terminy</h2>
          <p className="mt-2">Zgłoś umowę do urzędu skarbowego właściwego dla miejsca zamieszkania wynajmującego do <b className="font-mono">{zgloszenie ? pl(zgloszenie) : 'podaj datę rozpoczęcia'}</b>, czyli w 14 dni od rozpoczęcia najmu. Bez zgłoszenia umowa nie daje ochrony najmu okazjonalnego.</p>
          <p className="mt-2">Akt notarialny najemcy musi być gotowy przy podpisaniu umowy. Notariusz pobiera opłatę według rozporządzenia o taksie notarialnej.</p>
        </section>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => { if (ready) window.print(); else setPokazBraki(true) }} className="min-h-11 rounded-full bg-accent px-6 text-sm font-semibold text-white">
            Drukuj albo zapisz PDF
          </button>
          <button type="button" onClick={() => { if (window.confirm('Wyczyścić wszystkie pola?')) setDraft(emptyDraft()) }} className="min-h-11 rounded-full border border-border px-5 text-sm font-semibold">
            Wyczyść
          </button>
        </div>
        {!ready && pokazBraki && <p role="alert" className="text-xs text-red-700">Uzupełnij pola oznaczone na czerwono, żeby wydrukować umowę.</p>}
        <SaveToFolder payload={payload} mode={mode} />
        <p className="text-xs text-foreground/50">Szkic zapisuje się tylko w tej przeglądarce. Nic nie wysyłamy na serwer.</p>
      </div>

      <article className="print-area min-w-0 rounded-2xl border border-border bg-white p-6 text-[13px] leading-6 text-[#1f1a14] sm:p-10">
        <h2 className="text-center text-lg font-bold">UMOWA NAJMU OKAZJONALNEGO LOKALU</h2>
        <p className="mt-2 text-center">zawarta w {dots(draft.miejsce)} dnia {pl(draft.dataZawarcia)} pomiędzy:</p>
        <p className="mt-3"><b>{dots(draft.wynajmujacy.imieNazwisko)}</b>, zam. {dots(draft.wynajmujacy.adres)}{draft.wynajmujacy.dokument ? `, legitymującym się ${draft.wynajmujacy.dokument}` : ''}, zwanym dalej <b>Wynajmującym</b>,</p>
        <p className="mt-2">a</p>
        <p className="mt-2"><b>{dots(draft.najemca.imieNazwisko)}</b>, zam. {dots(draft.najemca.adres)}{draft.najemca.dokument ? `, legitymującym się ${draft.najemca.dokument}` : ''}, zwanym dalej <b>Najemcą</b>.</p>
        <p className="mt-3">Umowa jest umową najmu okazjonalnego lokalu w rozumieniu art. 19a do 19e ustawy z dnia 21 czerwca 2001 r. o ochronie praw lokatorów, mieszkaniowym zasobie gminy i o zmianie Kodeksu cywilnego.</p>

        <h3 className="mt-5 text-center font-bold">§ 1. Przedmiot najmu</h3>
        <p>1. Wynajmujący oświadcza, że przysługuje mu tytuł prawny do lokalu mieszkalnego położonego w {dots(draft.lokalAdres)}{draft.lokalPowierzchnia ? `, o powierzchni ${draft.lokalPowierzchnia} m²` : ''}{draft.lokalPokoje ? `, składającego się z ${draft.lokalPokoje} pokoi` : ''}, zwanego dalej Lokalem.</p>
        <p>2. Wynajmujący oświadcza, że jest osobą fizyczną i nie prowadzi działalności gospodarczej w zakresie wynajmowania lokali.</p>
        <p>3. Wynajmujący oddaje Najemcy Lokal do używania w celach mieszkaniowych{draft.wyposazenie ? ` wraz z wyposażeniem: ${draft.wyposazenie}` : ''}. Stan Lokalu określa protokół zdawczo-odbiorczy, który jest załącznikiem do umowy.</p>
        {draft.wspolzamieszkujacy.trim() && <p>4. Razem z Najemcą w Lokalu będą zamieszkiwać: {draft.wspolzamieszkujacy}.</p>}

        <h3 className="mt-5 text-center font-bold">§ 2. Czas trwania</h3>
        <p>Umowa zostaje zawarta na czas oznaczony od dnia {pl(draft.dataOd)} do dnia {pl(draft.dataDo)}.</p>

        <h3 className="mt-5 text-center font-bold">§ 3. Czynsz i opłaty</h3>
        <p>1. Najemca płaci miesięczny czynsz w wysokości {kw(draft.czynsz)}, z góry, do {dots(draft.terminPlatnosci)}. dnia każdego miesiąca{draft.rachunek.trim() ? `, na rachunek Wynajmującego nr ${draft.rachunek}` : ', gotówką za pokwitowaniem'}.</p>
        <p>2. {draft.oplaty}</p>

        <h3 className="mt-5 text-center font-bold">§ 4. Kaucja</h3>
        <p>1. Najemca wpłaca kaucję w wysokości {kw(draft.kaucja)} na zabezpieczenie należności z tytułu najmu, przysługujących Wynajmującemu w dniu opróżnienia Lokalu.</p>
        <p>2. Kaucja podlega zwrotowi w ciągu miesiąca od dnia opróżnienia Lokalu, po potrąceniu należności Wynajmującego.</p>

        <h3 className="mt-5 text-center font-bold">§ 5. Obowiązki stron</h3>
        <p>1. Najemca używa Lokalu zgodnie z przeznaczeniem, dba o jego stan i wykonuje drobne naprawy związane ze zwykłym używaniem.</p>
        <p>2. Najemca nie może oddać Lokalu w podnajem ani do bezpłatnego używania bez pisemnej zgody Wynajmującego.</p>
        <p>3. Zwierzęta w Lokalu: {draft.zwierzeta === 'za zgodą' ? 'za pisemną zgodą Wynajmującego' : draft.zwierzeta}.</p>
        <p>4. Po zakończeniu najmu Najemca zwraca Lokal w stanie niepogorszonym, z uwzględnieniem zużycia wynikającego z prawidłowego używania.</p>

        <h3 className="mt-5 text-center font-bold">§ 6. Załączniki</h3>
        <p>Integralną częścią umowy są:</p>
        <ol className="list-decimal pl-6">
          {ZALACZNIKI.map((z) => <li key={z}>{z}</li>)}
        </ol>
        <p className="mt-1">Najemca wskazuje lokal, o którym mowa w pkt 2: {dots(draft.lokalZastepczyAdres)}.</p>

        <h3 className="mt-5 text-center font-bold">§ 7. Zgłoszenie i wypowiedzenie</h3>
        <p>1. Wynajmujący zgłosi zawarcie umowy naczelnikowi urzędu skarbowego właściwemu ze względu na miejsce zamieszkania Wynajmującego w terminie 14 dni od dnia rozpoczęcia najmu.</p>
        <p>2. Umowa może zostać wypowiedziana w przypadkach i terminach określonych w ustawie o ochronie praw lokatorów.</p>

        <h3 className="mt-5 text-center font-bold">§ 8. Postanowienia końcowe</h3>
        <p>1. Zmiany umowy wymagają formy pisemnej pod rygorem nieważności.</p>
        <p>2. W sprawach nieuregulowanych stosuje się przepisy ustawy o ochronie praw lokatorów i Kodeksu cywilnego.</p>
        <p>3. Umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze stron.</p>

        <div className="mt-12 grid grid-cols-2 gap-10 text-center text-xs">
          <div className="border-t border-[#1f1a14] pt-2">Wynajmujący</div>
          <div className="border-t border-[#1f1a14] pt-2">Najemca</div>
        </div>
        <p className="no-print mt-8 text-xs text-[#6f5a44]">Wzór przygotowany na podstawie ustawy. Nie jest poradą prawną. Przy nietypowej sytuacji skonsultuj umowę z prawnikiem.</p>
      </article>
    </div>
  )
}
