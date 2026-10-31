/**
 * Rejestr cen transakcyjnych w platformie.
 *
 * Dane bierzemy z publicznego API działającego produktu
 * https://rejestr-cen-transakcyjnych.pl/api/ceny (bez zmian w tamtym produkcie).
 * Tu tylko przycinamy odpowiedź i liczymy wycenę dla podobnych mieszkań.
 */
export const RCN_COLUMNS = ['d', 'dz', 'ul', 'nr', 'pow', 'pok', 'pietro', 'rynek', 'cena', 'm2', 'lat', 'lon'] as const

export type RcnRow = [
  string,
  string | null,
  string | null,
  string | null,
  number | null,
  number | null,
  number | null,
  string | null,
  number | null,
  number | null,
  number | null,
  number | null,
]

export type RcnSummary = { liczba: number; mediana: number; p25: number; p75: number }

export type RcnApiResponse = {
  teryt: string
  nazwa: string
  od?: string
  dane_do?: string
  liczba: number
  podsumowanie: RcnSummary | null
  dzielnice_lista: Array<{ nazwa: string } & RcnSummary>
  miesiace: Array<{ mies: string } & RcnSummary>
  kolumny: string[]
  wiersze: RcnRow[]
}

export type Transaction = {
  data: string
  dzielnica: string | null
  ulica: string | null
  powierzchnia: number | null
  pokoje: number | null
  rynek: string | null
  cena: number | null
  cenaM2: number | null
}

export type SimilarQuery = { dzielnica?: string; metraz?: number; rynek?: string }

export type Estimate = {
  podobne: number
  medianaM2: number
  p25M2: number
  p75M2: number
  wartosc: number | null
  wartoscOd: number | null
  wartoscDo: number | null
  zakres: string
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo))
}

export function toTransaction(row: RcnRow): Transaction {
  return {
    data: row[0],
    dzielnica: row[1],
    ulica: row[2],
    powierzchnia: row[4],
    pokoje: row[5],
    rynek: row[7],
    cena: row[8],
    cenaM2: row[9],
  }
}

/** Najmniejsza liczba transakcji, przy której pokazujemy wycenę. */
export const MIN_SIMILAR = 8

export function findSimilar(rows: RcnRow[], query: SimilarQuery) {
  const tx = rows.map(toTransaction).filter((t) => typeof t.cenaM2 === 'number' && t.cenaM2 > 0)
  const byDistrict = query.dzielnica ? tx.filter((t) => t.dzielnica === query.dzielnica) : tx
  const byMarket = query.rynek ? byDistrict.filter((t) => t.rynek === query.rynek) : byDistrict
  if (!query.metraz) return { rows: byMarket, zakres: 'wszystkie metraże' }

  for (const delta of [10, 20, 35]) {
    const near = byMarket.filter(
      (t) => t.powierzchnia !== null && Math.abs(t.powierzchnia - query.metraz!) <= delta,
    )
    if (near.length >= MIN_SIMILAR) return { rows: near, zakres: `metraż ±${delta} m²` }
  }
  return { rows: byMarket, zakres: 'wszystkie metraże (za mało podobnych)' }
}

export function estimate(rows: RcnRow[], query: SimilarQuery): Estimate | null {
  const { rows: similar, zakres } = findSimilar(rows, query)
  if (similar.length < MIN_SIMILAR) return null
  const m2 = similar.map((t) => t.cenaM2 as number).sort((a, b) => a - b)
  const medianaM2 = percentile(m2, 0.5)
  const p25M2 = percentile(m2, 0.25)
  const p75M2 = percentile(m2, 0.75)
  const area = query.metraz ?? null
  const round = (n: number) => Math.round(n / 1000) * 1000
  return {
    podobne: similar.length,
    medianaM2,
    p25M2,
    p75M2,
    wartosc: area ? round(medianaM2 * area) : null,
    wartoscOd: area ? round(p25M2 * area) : null,
    wartoscDo: area ? round(p75M2 * area) : null,
    zakres,
  }
}

export function latest(rows: RcnRow[], query: SimilarQuery, limit = 30): Transaction[] {
  return findSimilar(rows, query)
    .rows.sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, limit)
}
