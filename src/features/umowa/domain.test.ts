import { describe, expect, it } from 'vitest'
import { emptyDraft, gotowa, sprawdz, terminZgloszenia, type UmowaDraft } from './domain'

function pelna(): UmowaDraft {
  const d = emptyDraft(new Date('2026-11-01T12:00:00Z'))
  return {
    ...d,
    wynajmujacy: { imieNazwisko: 'Anna Nowak', adres: 'Gdańsk, ul. Długa 1', dokument: '' },
    wynajmujacyBezDzialalnosci: true,
    najemca: { imieNazwisko: 'Piotr Kowal', adres: 'Sopot, ul. Morska 2', dokument: '' },
    lokalAdres: 'Gdańsk, ul. Szeroka 5/3',
    lokalZastepczyAdres: 'Gdynia, ul. Polna 7',
    dataOd: '2026-11-01',
    dataDo: '2027-10-31',
    czynsz: '2500',
    kaucja: '5000',
    rachunek: '12 3456',
  }
}

const blokujace = (d: UmowaDraft) => sprawdz(d).filter((p) => p.blokuje).map((p) => p.pole)

describe('umowa najmu okazjonalnego', () => {
  it('przepuszcza poprawnie wypełnioną umowę', () => {
    expect(blokujace(pelna())).toEqual([])
    expect(gotowa(pelna())).toBe(true)
  })

  it('liczy termin zgłoszenia do urzędu skarbowego: 14 dni od rozpoczęcia najmu', () => {
    expect(terminZgloszenia({ dataOd: '2026-11-01' })).toBe('2026-11-15')
    expect(terminZgloszenia({ dataOd: '2026-12-25' })).toBe('2027-01-08')
  })

  it('blokuje najem dłuższy niż 10 lat i dopuszcza dokładnie 10 lat', () => {
    expect(blokujace({ ...pelna(), dataDo: '2036-11-02' })).toContain('dataDo')
    expect(blokujace({ ...pelna(), dataDo: '2036-11-01' })).not.toContain('dataDo')
  })

  it('blokuje umowę bez daty końca, bo najem okazjonalny jest na czas oznaczony', () => {
    expect(blokujace({ ...pelna(), dataDo: '' })).toContain('dataDo')
  })

  it('blokuje kaucję wyższą niż 6 czynszów i dopuszcza dokładnie 6', () => {
    expect(blokujace({ ...pelna(), kaucja: '15000,01' })).toContain('kaucja')
    expect(blokujace({ ...pelna(), kaucja: '15000' })).not.toContain('kaucja')
  })

  it('wymaga potwierdzenia, że wynajmujący nie prowadzi działalności w wynajmie', () => {
    expect(blokujace({ ...pelna(), wynajmujacyBezDzialalnosci: false })).toContain('wynajmujacyBezDzialalnosci')
  })

  it('wymaga adresu lokalu zastępczego, bo to obowiązkowy załącznik', () => {
    expect(blokujace({ ...pelna(), lokalZastepczyAdres: ' ' })).toContain('lokalZastepczyAdres')
  })

  it('brak rachunku to ostrzeżenie, nie blokada', () => {
    const d = { ...pelna(), rachunek: '' }
    expect(gotowa(d)).toBe(true)
    expect(sprawdz(d).find((p) => p.pole === 'rachunek')?.blokuje).toBe(false)
  })
})
