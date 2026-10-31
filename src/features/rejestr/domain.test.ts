import { describe, expect, it } from 'vitest'
import { estimate, findSimilar, latest, MIN_SIMILAR, type RcnRow } from './domain'

function row(d: string, dz: string, pow: number, m2: number, rynek = 'wtórny'): RcnRow {
  return [d, dz, 'Ulica', '1', pow, 2, 1, rynek, Math.round(pow * m2), m2, 54, 18]
}

const rows: RcnRow[] = [
  ...Array.from({ length: 10 }, (_, i) => row(`2026-0${(i % 9) + 1}-10`, 'Wrzeszcz', 48 + i, 14000 + i * 100)),
  ...Array.from({ length: 10 }, (_, i) => row(`2026-0${(i % 9) + 1}-11`, 'Oliwa', 90 + i, 9000 + i * 100)),
  row('2026-09-01', 'Wrzeszcz', 50, 0),
]

describe('rejestr: wycena z podobnych transakcji', () => {
  it('liczy medianę i widełki dla dzielnicy i metrażu', () => {
    const e = estimate(rows, { dzielnica: 'Wrzeszcz', metraz: 52 })
    expect(e).not.toBeNull()
    expect(e!.podobne).toBe(10)
    expect(e!.medianaM2).toBe(14450)
    expect(e!.wartosc).toBe(Math.round((14450 * 52) / 1000) * 1000)
    expect(e!.wartoscOd!).toBeLessThanOrEqual(e!.wartosc!)
    expect(e!.wartoscDo!).toBeGreaterThanOrEqual(e!.wartosc!)
    expect(e!.zakres).toBe('metraż ±10 m²')
  })

  it('pomija transakcje bez ceny za metr', () => {
    expect(findSimilar(rows, { dzielnica: 'Wrzeszcz' }).rows.every((t) => (t.cenaM2 ?? 0) > 0)).toBe(true)
  })

  it('nie wycenia przy zbyt małej próbie', () => {
    const few = rows.slice(0, MIN_SIMILAR - 1)
    expect(estimate(few, { dzielnica: 'Wrzeszcz', metraz: 50 })).toBeNull()
  })

  it('poszerza zakres metrażu, gdy podobnych jest za mało', () => {
    expect(findSimilar(rows, { dzielnica: 'Oliwa', metraz: 80 }).zakres).toBe('metraż ±20 m²')
  })

  it('zwraca najnowsze transakcje jako pierwsze', () => {
    const list = latest(rows, { dzielnica: 'Oliwa' }, 3)
    expect(list).toHaveLength(3)
    expect(list[0].data >= list[1].data).toBe(true)
  })
})
