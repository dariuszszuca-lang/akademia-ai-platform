/**
 * Księga wieczysta po ludzku.
 *
 * Użytkownik wkleja treść księgi skopiowaną z przeglądarki ksiąg wieczystych
 * (https://przegladarka-ekw.ms.gov.pl). Rozpoznanie działa w przeglądarce, regułami, bez AI.
 * Treść księgi (imiona, PESEL) nie jest nigdzie wysyłana.
 */
export type DzialId = 'I-O' | 'I-Sp' | 'II' | 'III' | 'IV'

export const DZIALY: Record<DzialId, string> = {
  'I-O': 'Oznaczenie nieruchomości',
  'I-Sp': 'Spis praw związanych z własnością',
  II: 'Własność',
  III: 'Prawa, roszczenia i ograniczenia',
  IV: 'Hipoteka',
}

export type Waga = 'ok' | 'uwaga' | 'ryzyko'

export type Flaga = {
  dzial: DzialId | 'wzmianki'
  waga: Waga
  tytul: string
  poLudzku: string
  pytanie: string
}

export type Hipoteka = { suma: string | null; waluta: string | null; wierzyciel: string | null }

export type Analiza = {
  numer: string | null
  numerPoprawny: boolean
  znalezioneDzialy: DzialId[]
  brakujaceDzialy: DzialId[]
  lokal: { adres: string | null; powierzchnia: string | null; przeznaczenie: string | null }
  wlasciciele: Array<{ nazwa: string; udzial: string | null }>
  hipoteki: Hipoteka[]
  flagi: Flaga[]
  pytania: string[]
  tekstDzialow: Partial<Record<DzialId, string>>
}

const NUMER = /\b([A-Z]{2}\d[A-Z])\s*\/\s*(\d{8})\s*\/\s*(\d)\b/

export function normalizujNumer(raw: string): string | null {
  const m = raw.toUpperCase().match(NUMER)
  return m ? `${m[1]}/${m[2]}/${m[3]}` : null
}

const NAGLOWEK = /DZIA[ŁL]\s+(I\s*-\s*O|I\s*-\s*SP|IV|III|II)\b/gi

function idDzialu(raw: string): DzialId {
  const k = raw.toUpperCase().replace(/\s/g, '')
  if (k === 'I-O') return 'I-O'
  if (k === 'I-SP') return 'I-Sp'
  return k as DzialId
}

export function podzielNaDzialy(tekst: string): Partial<Record<DzialId, string>> {
  const out: Partial<Record<DzialId, string>> = {}
  const trafienia = [...tekst.matchAll(NAGLOWEK)]
  trafienia.forEach((m, i) => {
    // pomijamy resztę linii nagłówka, np. „ - PRAWA, ROSZCZENIA I OGRANICZENIA”
    const poNaglowku = tekst.indexOf('\n', m.index! + m[0].length)
    const start = poNaglowku === -1 ? tekst.length : poNaglowku + 1
    const koniec = i + 1 < trafienia.length ? trafienia[i + 1].index! : tekst.length
    const id = idDzialu(m[1])
    out[id] = ((out[id] ?? '') + '\n' + tekst.slice(Math.min(start, koniec), koniec)).trim()
  })
  return out
}

/** Wartość pola: „Etykieta<tab>Wartość”, „Etykieta: Wartość” albo wartość w następnej linii. */
export function pole(tekst: string, etykieta: string): string | null {
  const linie = tekst.split(/\r?\n/).map((l) => l.trim())
  const re = new RegExp(`^${etykieta}\\s*[:\\t]?\\s*(.*)$`, 'i')
  for (let i = 0; i < linie.length; i++) {
    const m = linie[i].match(re)
    if (!m) continue
    const wartosc = m[1].replace(/^[:\t\s]+/, '').trim()
    if (wartosc && wartosc !== '---') return wartosc
    const nast = linie.slice(i + 1).find((l) => l.length > 0)
    if (nast && nast !== '---') return nast
  }
  return null
}

function wszystkie(tekst: string, etykieta: string): string[] {
  const out: string[] = []
  let reszta = tekst
  for (;;) {
    const v = pole(reszta, etykieta)
    if (!v) break
    out.push(v)
    const re = new RegExp(etykieta, 'i')
    const idx = reszta.search(re)
    reszta = reszta.slice(idx + etykieta.length + v.length)
  }
  return out
}

/** Treść działu bez nagłówków rubryk („Rubryka 3.1 - Ostrzeżenia”), które same nie są wpisami. */
export function trescWpisow(t: string): string {
  return t
    .split(/\r?\n/)
    .filter((l) => !/^\s*(pod)?rubryka\b/i.test(l))
    .join('\n')
}

const pusty = (t: string | undefined) =>
  !t || /brak\s+wpis[óo]w/i.test(t) || t.replace(/rubryka[^\n]*|wzmianki[^\n]*|---/gi, '').trim().length < 3

type Regula = { wzor: RegExp; waga: Waga; tytul: string; poLudzku: string; pytanie: string }

const REGULY_III: Regula[] = [
  { wzor: /ostrze[żz]eni/i, waga: 'ryzyko', tytul: 'Ostrzeżenie w księdze', poLudzku: 'Ktoś twierdzi, że treść księgi nie zgadza się ze stanem prawnym, albo toczy się sprawa o własność.', pytanie: 'Czego dotyczy ostrzeżenie i czy sprawa się zakończyła? Poproś o dokumenty.' },
  { wzor: /egzekuc|zaj[ęe]ci|komornik/i, waga: 'ryzyko', tytul: 'Egzekucja albo zajęcie', poLudzku: 'Komornik prowadzi egzekucję z tej nieruchomości. Sprzedaż jest możliwa, ale zajęcie trzeba usunąć.', pytanie: 'Jak i kiedy zostanie spłacony dług i umorzona egzekucja?' },
  { wzor: /upad[łl]o[śs]/i, waga: 'ryzyko', tytul: 'Upadłość', poLudzku: 'Właściciel jest w upadłości. Sprzedaż prowadzi syndyk, nie właściciel.', pytanie: 'Kto może podpisać umowę i czy jest zgoda sędziego-komisarza?' },
  { wzor: /do[żz]ywoci/i, waga: 'ryzyko', tytul: 'Prawo dożywocia', poLudzku: 'Ktoś ma prawo mieszkać tu do końca życia. To prawo przechodzi na kupującego razem z mieszkaniem.', pytanie: 'Czy osoba uprawniona zrzeknie się dożywocia przed sprzedażą?' },
  { wzor: /s[łl]u[żz]ebno[śs][ćc]\s+osobist|s[łl]u[żz]ebno[śs][ćc]\s+mieszkani/i, waga: 'ryzyko', tytul: 'Służebność osobista', poLudzku: 'Konkretna osoba ma prawo korzystać z mieszkania, np. w nim mieszkać.', pytanie: 'Kto ma służebność i czy zostanie wykreślona przed sprzedażą?' },
  { wzor: /s[łl]u[żz]ebno[śs][ćc]\s+(gruntow|przesy[łl])/i, waga: 'uwaga', tytul: 'Służebność gruntowa albo przesyłu', poLudzku: 'Ktoś może przechodzić przez działkę albo prowadzić tędy instalacje. Przy mieszkaniu w bloku to częste.', pytanie: 'Czego dokładnie dotyczy służebność i czy ogranicza korzystanie z mieszkania?' },
  { wzor: /u[żz]ytkowani/i, waga: 'ryzyko', tytul: 'Użytkowanie', poLudzku: 'Ktoś inny niż właściciel może używać mieszkania i czerpać z niego dochód.', pytanie: 'Kto jest użytkownikiem i czy prawo wygaśnie przed sprzedażą?' },
  { wzor: /pierwokup/i, waga: 'uwaga', tytul: 'Prawo pierwokupu', poLudzku: 'Ktoś ma pierwszeństwo zakupu. Umowa sprzedaży musi być najpierw warunkowa.', pytanie: 'Kto ma prawo pierwokupu i czy notariusz przewidział umowę warunkową?' },
  { wzor: /najm|dzier[żz]aw/i, waga: 'uwaga', tytul: 'Najem albo dzierżawa w księdze', poLudzku: 'Wpisany najem trwa także po zmianie właściciela.', pytanie: 'Do kiedy trwa najem i na jakich warunkach?' },
  { wzor: /roszczeni/i, waga: 'uwaga', tytul: 'Roszczenie', poLudzku: 'Ktoś zabezpieczył swoje roszczenie wobec tej nieruchomości, np. o przeniesienie własności.', pytanie: 'Czego dotyczy roszczenie i kto je zgłosił?' },
]

export function analizuj(tekst: string): Analiza {
  const dzialy = podzielNaDzialy(tekst)
  const znalezione = (Object.keys(DZIALY) as DzialId[]).filter((d) => d in dzialy)
  const brakujace = (Object.keys(DZIALY) as DzialId[]).filter((d) => !(d in dzialy))
  const numer = normalizujNumer(tekst)
  const flagi: Flaga[] = []

  const io = dzialy['I-O'] ?? ''
  const ulica = pole(io, 'Ulica')
  const nrBud = pole(io, 'Numer budynku')
  const nrLok = pole(io, 'Numer lokalu')
  const miejscowosc = pole(io, 'Miejscowo[śs][ćc]')
  const adres = [miejscowosc, ulica && `ul. ${ulica} ${nrBud ?? ''}${nrLok ? `/${nrLok}` : ''}`.trim()].filter(Boolean).join(', ') || null
  const lokal = {
    adres,
    powierzchnia: pole(io, 'Powierzchnia u[żz]ytkowa(?: lokalu)?') ?? pole(io, 'Obszar'),
    przeznaczenie: pole(io, 'Przeznaczenie lokalu'),
  }

  const ii = dzialy.II ?? ''
  const imiona = wszystkie(ii, 'Imi[ęe] pierwsze')
  const nazwiska = wszystkie(ii, 'Nazwisko')
  const udzialy = wszystkie(ii, 'Wielko[śs][ćc] udzia[łl]u')
  const firmy = wszystkie(ii, 'Nazwa')
  const wlasciciele = [
    ...imiona.map((imie, i) => ({ nazwa: `${imie} ${nazwiska[i] ?? ''}`.trim(), udzial: udzialy[i] ?? null })),
    ...firmy.map((nazwa, i) => ({ nazwa, udzial: udzialy[imiona.length + i] ?? null })),
  ]
  if (wlasciciele.length > 1) {
    flagi.push({ dzial: 'II', waga: 'uwaga', tytul: `Właścicieli jest ${wlasciciele.length}`, poLudzku: 'Umowę sprzedaży muszą podpisać wszyscy współwłaściciele albo ich pełnomocnicy.', pytanie: 'Czy wszyscy właściciele będą u notariusza albo dadzą notarialne pełnomocnictwo?' })
  }
  if (/sp[óo]lno[śs][ćc]\s+ustawow|ma[łl][żz]e[ńn]/i.test(ii)) {
    flagi.push({ dzial: 'II', waga: 'uwaga', tytul: 'Wspólność małżeńska', poLudzku: 'Mieszkanie należy do małżonków razem. Podpisują oboje.', pytanie: 'Czy oboje małżonkowie podpiszą umowę?' })
  }

  const iii = dzialy.III
  if ('III' in dzialy && pusty(iii)) {
    flagi.push({ dzial: 'III', waga: 'ok', tytul: 'Dział III bez wpisów', poLudzku: 'Nie ma służebności, dożywocia, ostrzeżeń ani egzekucji.', pytanie: '' })
  } else if (iii) {
    const wpisy = trescWpisow(iii)
    const trafione = REGULY_III.filter((r) => r.wzor.test(wpisy))
    for (const r of trafione) flagi.push({ dzial: 'III', waga: r.waga, tytul: r.tytul, poLudzku: r.poLudzku, pytanie: r.pytanie })
    if (trafione.length === 0) {
      flagi.push({ dzial: 'III', waga: 'uwaga', tytul: 'Wpis w dziale III', poLudzku: 'Są wpisy, których nie rozpoznaliśmy automatycznie. Przeczytaj je poniżej.', pytanie: 'Czego dotyczą wpisy w dziale III?' })
    }
  }

  const iv = dzialy.IV ?? ''
  const hipoteki: Hipoteka[] = []
  if ('IV' in dzialy && !pusty(iv)) {
    const sumy = wszystkie(iv, 'Suma')
    const waluty = wszystkie(iv, 'Waluta')
    const wierzyciele = wszystkie(iv, 'Wierzyciel(?: hipoteczny)?(?: \\(nazwa\\))?')
    const n = sumy.length || (/hipoteka\s+(umowna|przymusowa|kaucyjna)|rodzaj hipoteki/i.test(trescWpisow(iv)) ? 1 : 0)
    for (let i = 0; i < n; i++) hipoteki.push({ suma: sumy[i] ?? null, waluta: waluty[i] ?? null, wierzyciel: wierzyciele[i] ?? null })
  }
  if ('IV' in dzialy) {
    if (hipoteki.length === 0) {
      flagi.push({ dzial: 'IV', waga: 'ok', tytul: 'Brak hipotek', poLudzku: 'Mieszkanie nie zabezpiecza żadnego kredytu.', pytanie: '' })
    } else {
      flagi.push({ dzial: 'IV', waga: 'ryzyko', tytul: `Hipotek: ${hipoteki.length}`, poLudzku: 'Mieszkanie zabezpiecza kredyt. Hipoteka zostaje na mieszkaniu po sprzedaży, dopóki bank jej nie wykreśli.', pytanie: 'Ile zostało do spłaty i czy bank wyda zaświadczenie oraz zgodę na wykreślenie hipoteki po spłacie z ceny?' })
    }
  }

  const wzmianki = (tekst.match(/DZ\.?\s*KW\.?\s*\/\s*[A-Z0-9]+\s*\/\s*\d+\s*\/\s*\d{2,4}/gi) ?? []).length
  if (wzmianki > 0) {
    flagi.push({ dzial: 'wzmianki', waga: 'ryzyko', tytul: `Wzmianki o wnioskach: ${wzmianki}`, poLudzku: 'Do sądu wpłynął wniosek o zmianę wpisu, którego jeszcze nie rozpatrzono. Księga może się wkrótce zmienić.', pytanie: 'Czego dotyczy wniosek i kto go złożył?' })
  }

  const pytania = [
    ...flagi.map((f) => f.pytanie).filter(Boolean),
    'Czy w mieszkaniu ktoś jest zameldowany i czy wymelduje się przed wydaniem?',
    'Czy są zaległości w opłatach do wspólnoty albo spółdzielni? Poproś o zaświadczenie.',
  ]

  return {
    numer,
    numerPoprawny: Boolean(numer),
    znalezioneDzialy: znalezione,
    brakujaceDzialy: brakujace,
    lokal,
    wlasciciele,
    hipoteki,
    flagi,
    pytania: [...new Set(pytania)],
    tekstDzialow: dzialy,
  }
}

export const PRZYKLAD = `Numer księgi GD1G/00099999/0
DZIAŁ I-O - OZNACZENIE NIERUCHOMOŚCI
Rubryka 1.4 - Położenie
Województwo\tPOMORSKIE
Miejscowość\tGDAŃSK
Rubryka 1.10 - Lokal
Ulica\tPRZYKŁADOWA
Numer budynku\t12
Numer lokalu\t5
Przeznaczenie lokalu\tLOKAL MIESZKALNY
Powierzchnia użytkowa lokalu\t48,20 M2
DZIAŁ I-SP - SPIS PRAW ZWIĄZANYCH Z WŁASNOŚCIĄ
Udział związany z własnością lokalu\t482/10000
DZIAŁ II - WŁASNOŚĆ
Rubryka 2.2 - Właściciel
Wielkość udziału\t1/2
Osoba fizyczna
Imię pierwsze\tJAN
Nazwisko\tPRZYKŁADOWY
Wielkość udziału\t1/2
Osoba fizyczna
Imię pierwsze\tANNA
Nazwisko\tPRZYKŁADOWA
Wspólność ustawowa majątkowa małżeńska
DZIAŁ III - PRAWA, ROSZCZENIA I OGRANICZENIA
Rubryka 3.2 - Ograniczone prawa rzeczowe
Treść: SŁUŻEBNOŚĆ OSOBISTA MIESZKANIA NA RZECZ MARII PRZYKŁADOWEJ
DZIAŁ IV - HIPOTEKA
Rubryka 4.4 - Hipoteka
Suma\t420 000,00
Waluta\tZŁ
Wierzyciel hipoteczny (nazwa)\tBANK PRZYKŁADOWY SPÓŁKA AKCYJNA
Wzmianka: DZ.KW./GD1G/12345/26`
