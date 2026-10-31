/**
 * Umowa najmu okazjonalnego lokalu (ustawa z 21 czerwca 2001 r. o ochronie praw lokatorów,
 * mieszkaniowym zasobie gminy i o zmianie Kodeksu cywilnego, art. 19a do 19e).
 * Tekst ustawy: https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20010710733
 *
 * Kreator nie jest poradą prawną. Limity poniżej pilnują warunków ustawy,
 * które da się sprawdzić automatycznie.
 */
export type Strona = {
  imieNazwisko: string
  adres: string
  dokument: string
}

export type UmowaDraft = {
  miejsce: string
  dataZawarcia: string
  wynajmujacy: Strona
  wynajmujacyBezDzialalnosci: boolean
  najemca: Strona
  wspolzamieszkujacy: string
  lokalAdres: string
  lokalPowierzchnia: string
  lokalPokoje: string
  wyposazenie: string
  dataOd: string
  dataDo: string
  czynsz: string
  terminPlatnosci: string
  rachunek: string
  oplaty: string
  kaucja: string
  lokalZastepczyAdres: string
  zwierzeta: 'nie' | 'tak' | 'za zgodą'
}

export const MAX_LAT = 10
export const MAX_KAUCJA_KROTNOSC = 6
export const DNI_NA_ZGLOSZENIE = 14

export function emptyDraft(today = new Date()): UmowaDraft {
  const iso = today.toISOString().slice(0, 10)
  const strona = { imieNazwisko: '', adres: '', dokument: '' }
  return {
    miejsce: '',
    dataZawarcia: iso,
    wynajmujacy: { ...strona },
    wynajmujacyBezDzialalnosci: false,
    najemca: { ...strona },
    wspolzamieszkujacy: '',
    lokalAdres: '',
    lokalPowierzchnia: '',
    lokalPokoje: '',
    wyposazenie: '',
    dataOd: iso,
    dataDo: '',
    czynsz: '',
    terminPlatnosci: '10',
    rachunek: '',
    oplaty: 'Najemca pokrywa opłaty za energię elektryczną, gaz, wodę i wywóz śmieci według zużycia i rachunków.',
    kaucja: '',
    lokalZastepczyAdres: '',
    zwierzeta: 'za zgodą',
  }
}

export function parseAmount(value: string): number | null {
  const n = Number(value.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function addDays(value: string, days: number): string | null {
  const d = parseDate(value)
  if (!d) return null
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function addYears(value: string, years: number): string | null {
  const d = parseDate(value)
  if (!d) return null
  d.setUTCFullYear(d.getUTCFullYear() + years)
  return d.toISOString().slice(0, 10)
}

/** Ostatni dzień zgłoszenia umowy do urzędu skarbowego: 14 dni od rozpoczęcia najmu. */
export function terminZgloszenia(draft: Pick<UmowaDraft, 'dataOd'>): string | null {
  return addDays(draft.dataOd, DNI_NA_ZGLOSZENIE)
}

export type Problem = { pole: string; opis: string; blokuje: boolean }

export function sprawdz(draft: UmowaDraft): Problem[] {
  const p: Problem[] = []
  const wymagane: Array<[string, string]> = [
    ['wynajmujacy.imieNazwisko', draft.wynajmujacy.imieNazwisko],
    ['wynajmujacy.adres', draft.wynajmujacy.adres],
    ['najemca.imieNazwisko', draft.najemca.imieNazwisko],
    ['najemca.adres', draft.najemca.adres],
    ['lokalAdres', draft.lokalAdres],
    ['lokalZastepczyAdres', draft.lokalZastepczyAdres],
  ]
  for (const [pole, v] of wymagane) {
    if (!v.trim()) p.push({ pole, opis: 'Uzupełnij to pole.', blokuje: true })
  }

  if (!draft.wynajmujacyBezDzialalnosci) {
    p.push({
      pole: 'wynajmujacyBezDzialalnosci',
      opis: 'Najem okazjonalny może zawrzeć osoba fizyczna, która nie prowadzi działalności gospodarczej w zakresie wynajmowania lokali. Potwierdź to.',
      blokuje: true,
    })
  }

  const od = parseDate(draft.dataOd)
  const doDaty = parseDate(draft.dataDo)
  if (!od) p.push({ pole: 'dataOd', opis: 'Podaj datę rozpoczęcia najmu.', blokuje: true })
  if (!doDaty) p.push({ pole: 'dataDo', opis: 'Najem okazjonalny jest zawsze na czas oznaczony. Podaj datę końca.', blokuje: true })
  if (od && doDaty) {
    if (doDaty <= od) p.push({ pole: 'dataDo', opis: 'Koniec najmu musi być po jego rozpoczęciu.', blokuje: true })
    const limit = parseDate(addYears(draft.dataOd, MAX_LAT)!)!
    if (doDaty > limit) {
      p.push({ pole: 'dataDo', opis: `Najem okazjonalny trwa najwyżej ${MAX_LAT} lat.`, blokuje: true })
    }
  }

  const czynsz = parseAmount(draft.czynsz)
  const kaucja = parseAmount(draft.kaucja)
  if (!czynsz) p.push({ pole: 'czynsz', opis: 'Podaj miesięczny czynsz.', blokuje: true })
  if (draft.kaucja.trim() && !kaucja) p.push({ pole: 'kaucja', opis: 'Kaucja musi być kwotą.', blokuje: true })
  if (czynsz && kaucja && kaucja > czynsz * MAX_KAUCJA_KROTNOSC) {
    p.push({
      pole: 'kaucja',
      opis: `Kaucja nie może przekroczyć ${MAX_KAUCJA_KROTNOSC}-krotności miesięcznego czynszu (${(czynsz * MAX_KAUCJA_KROTNOSC).toFixed(2)} zł).`,
      blokuje: true,
    })
  }

  const termin = Number(draft.terminPlatnosci)
  if (!Number.isInteger(termin) || termin < 1 || termin > 28) {
    p.push({ pole: 'terminPlatnosci', opis: 'Dzień płatności od 1 do 28.', blokuje: true })
  }
  if (!draft.rachunek.trim()) {
    p.push({ pole: 'rachunek', opis: 'Bez numeru rachunku czynsz będzie płacony gotówką za pokwitowaniem.', blokuje: false })
  }
  return p
}

export function gotowa(draft: UmowaDraft): boolean {
  return sprawdz(draft).every((problem) => !problem.blokuje)
}

export const ZALACZNIKI = [
  'Oświadczenie najemcy w formie aktu notarialnego, w którym najemca poddał się egzekucji i zobowiązał się do opróżnienia i wydania lokalu w terminie wskazanym w żądaniu wynajmującego.',
  'Wskazanie przez najemcę innego lokalu, w którym będzie mógł zamieszkać w razie wykonania egzekucji obowiązku opróżnienia lokalu.',
  'Oświadczenie właściciela lokalu wskazanego w punkcie 2 (albo osoby mającej do niego tytuł prawny) o zgodzie na zamieszkanie w nim najemcy i osób z nim zamieszkujących.',
  'Protokół zdawczo-odbiorczy lokalu.',
] as const
