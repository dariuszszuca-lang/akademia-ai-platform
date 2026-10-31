/**
 * Protokół zdawczo-odbiorczy mieszkania.
 * Cały protokół (dane osób, zdjęcia, podpisy) zostaje na urządzeniu użytkownika.
 */
export type Stan = 'dobry' | 'zużycie' | 'uszkodzenie' | 'brak'

export const STANY: Array<{ value: Stan; label: string }> = [
  { value: 'dobry', label: 'dobry' },
  { value: 'zużycie', label: 'zwykłe zużycie' },
  { value: 'uszkodzenie', label: 'uszkodzenie' },
  { value: 'brak', label: 'brak' },
]

export type Element = { id: string; nazwa: string; stan: Stan; uwagi: string; zdjecia: string[] }
export type Pokoj = { id: string; nazwa: string; elementy: Element[] }
export type Licznik = { id: string; rodzaj: string; numer: string; stan: string; zdjecie?: string }
export type Klucz = { id: string; nazwa: string; ilosc: number }
export type Potracenie = { id: string; opis: string; kwota: number }

export type Protokol = {
  id: string
  typ: 'wydanie' | 'zwrot'
  data: string
  adres: string
  wynajmujacy: string
  najemca: string
  liczniki: Licznik[]
  pokoje: Pokoj[]
  klucze: Klucz[]
  uwagi: string
  podpisWynajmujacego?: string
  podpisNajemcy?: string
  /** tylko przy zwrocie: kopia protokołu wydania do porównania */
  wydanie?: Protokol
  kaucja?: number
  potracenia: Potracenie[]
  utworzono: string
  zmieniono: string
}

let counter = 0
export function newId(prefix = 'x') {
  counter += 1
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : String(Date.now())
  return `${prefix}-${rand}-${counter}`
}

function el(nazwa: string): Element {
  return { id: newId('e'), nazwa, stan: 'dobry', uwagi: '', zdjecia: [] }
}

const OGOLNE = ['Ściany i sufit', 'Podłoga', 'Okna i parapety', 'Drzwi', 'Oświetlenie i gniazdka']

export function domyslnePokoje(): Pokoj[] {
  return [
    { id: newId('p'), nazwa: 'Przedpokój', elementy: [...OGOLNE, 'Szafa'].map(el) },
    { id: newId('p'), nazwa: 'Pokój', elementy: [...OGOLNE, 'Grzejnik'].map(el) },
    { id: newId('p'), nazwa: 'Kuchnia', elementy: [...OGOLNE, 'Zlew i bateria', 'Kuchenka', 'Lodówka', 'Szafki'].map(el) },
    { id: newId('p'), nazwa: 'Łazienka', elementy: [...OGOLNE, 'Wanna albo prysznic', 'Umywalka', 'WC', 'Płytki'].map(el) },
  ]
}

export function nowyProtokol(typ: Protokol['typ'], teraz = new Date()): Protokol {
  const iso = teraz.toISOString()
  return {
    id: newId('protokol'),
    typ,
    data: iso.slice(0, 10),
    adres: '',
    wynajmujacy: '',
    najemca: '',
    liczniki: ['Prąd', 'Woda zimna', 'Woda ciepła', 'Gaz'].map((rodzaj) => ({ id: newId('l'), rodzaj, numer: '', stan: '' })),
    pokoje: domyslnePokoje(),
    klucze: [
      { id: newId('k'), nazwa: 'Klucze do mieszkania', ilosc: 2 },
      { id: newId('k'), nazwa: 'Klucz do skrzynki', ilosc: 1 },
    ],
    uwagi: '',
    potracenia: [],
    utworzono: iso,
    zmieniono: iso,
  }
}

/** Zwrot zaczyna się od kopii wydania: te same pokoje, liczniki i klucze, stany do sprawdzenia. */
export function zwrotZWydania(wydanie: Protokol, teraz = new Date()): Protokol {
  const base = nowyProtokol('zwrot', teraz)
  const { wydanie: _ignored, ...kopiaWydania } = wydanie
  void _ignored
  return {
    ...base,
    adres: wydanie.adres,
    wynajmujacy: wydanie.wynajmujacy,
    najemca: wydanie.najemca,
    liczniki: wydanie.liczniki.map((l) => ({ ...l, id: newId('l'), stan: '', zdjecie: undefined })),
    pokoje: wydanie.pokoje.map((p) => ({
      ...p,
      elementy: p.elementy.map((e) => ({ ...e, stan: e.stan, uwagi: '', zdjecia: [] })),
    })),
    klucze: wydanie.klucze.map((k) => ({ ...k, id: newId('k') })),
    wydanie: kopiaWydania,
    kaucja: wydanie.kaucja,
  }
}

const WAGA: Record<Stan, number> = { dobry: 0, zużycie: 1, uszkodzenie: 2, brak: 3 }

export type ZmianaElementu = {
  pokoj: string
  element: string
  przed: Stan
  po: Stan
  ocena: 'bez zmian' | 'zwykłe zużycie' | 'nowa szkoda' | 'lepiej niż przy wydaniu'
  uwagi: string
}

export type Porownanie = {
  elementy: ZmianaElementu[]
  noweSzkody: ZmianaElementu[]
  liczniki: Array<{ rodzaj: string; przed: number | null; po: number | null; zuzycie: number | null }>
  klucze: Array<{ nazwa: string; przed: number; po: number; brakuje: number }>
}

function num(v: string): number | null {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'))
  return v.trim() && Number.isFinite(n) ? n : null
}

export function porownaj(wydanie: Protokol, zwrot: Protokol): Porownanie {
  const elementy: ZmianaElementu[] = []
  for (const pz of zwrot.pokoje) {
    const pw = wydanie.pokoje.find((p) => p.nazwa === pz.nazwa)
    for (const ez of pz.elementy) {
      const ew = pw?.elementy.find((e) => e.nazwa === ez.nazwa)
      const przed = ew?.stan ?? 'dobry'
      const po = ez.stan
      let ocena: ZmianaElementu['ocena'] = 'bez zmian'
      if (WAGA[po] > WAGA[przed]) ocena = po === 'zużycie' ? 'zwykłe zużycie' : 'nowa szkoda'
      else if (WAGA[po] < WAGA[przed]) ocena = 'lepiej niż przy wydaniu'
      elementy.push({ pokoj: pz.nazwa, element: ez.nazwa, przed, po, ocena, uwagi: ez.uwagi })
    }
  }
  const liczniki = zwrot.liczniki.map((lz) => {
    const lw = wydanie.liczniki.find((l) => l.rodzaj === lz.rodzaj)
    const przed = lw ? num(lw.stan) : null
    const po = num(lz.stan)
    return { rodzaj: lz.rodzaj, przed, po, zuzycie: przed !== null && po !== null ? Math.round((po - przed) * 1000) / 1000 : null }
  })
  const klucze = wydanie.klucze.map((kw) => {
    const kz = zwrot.klucze.find((k) => k.nazwa === kw.nazwa)
    const po = kz?.ilosc ?? 0
    return { nazwa: kw.nazwa, przed: kw.ilosc, po, brakuje: Math.max(0, kw.ilosc - po) }
  })
  return { elementy, noweSzkody: elementy.filter((e) => e.ocena === 'nowa szkoda'), liczniki, klucze }
}

export type RozliczenieKaucji = { kaucja: number; potracenia: number; doZwrotu: number; doplata: number }

export function rozliczKaucje(kaucja: number | undefined, potracenia: Potracenie[]): RozliczenieKaucji {
  const k = Math.max(0, kaucja ?? 0)
  const suma = Math.round(potracenia.reduce((s, p) => s + Math.max(0, p.kwota || 0), 0) * 100) / 100
  return {
    kaucja: k,
    potracenia: suma,
    doZwrotu: Math.max(0, Math.round((k - suma) * 100) / 100),
    doplata: Math.max(0, Math.round((suma - k) * 100) / 100),
  }
}

export function gotowyDoPodpisu(p: Protokol): string[] {
  const braki: string[] = []
  if (!p.adres.trim()) braki.push('adres mieszkania')
  if (!p.wynajmujacy.trim()) braki.push('wynajmujący')
  if (!p.najemca.trim()) braki.push('najemca')
  if (p.liczniki.some((l) => !l.stan.trim())) braki.push('stany wszystkich liczników (wpisz 0 albo usuń licznik)')
  return braki
}

export function podpisany(p: Protokol) {
  return Boolean(p.podpisWynajmujacego && p.podpisNajemcy)
}
