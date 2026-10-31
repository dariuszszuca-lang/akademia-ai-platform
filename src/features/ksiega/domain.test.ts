import { describe, expect, it } from 'vitest'
import { PRZYKLAD, analizuj, normalizujNumer, pole, podzielNaDzialy } from './domain'

const tytuly = (t: string) => analizuj(t).flagi.map((f) => f.tytul)

describe('księga wieczysta po ludzku', () => {
  it('rozpoznaje numer księgi w różnych zapisach', () => {
    expect(normalizujNumer('gd1g / 00099999 / 0')).toBe('GD1G/00099999/0')
    expect(normalizujNumer('brak numeru')).toBeNull()
  })

  it('dzieli treść na pięć działów', () => {
    expect(Object.keys(podzielNaDzialy(PRZYKLAD)).sort()).toEqual(['I-O', 'I-Sp', 'II', 'III', 'IV'].sort())
  })

  it('czyta pola zapisane tabulatorem, dwukropkiem i w następnej linii', () => {
    expect(pole('Ulica\tDŁUGA', 'Ulica')).toBe('DŁUGA')
    expect(pole('Ulica: DŁUGA', 'Ulica')).toBe('DŁUGA')
    expect(pole('Ulica\n\nDŁUGA', 'Ulica')).toBe('DŁUGA')
  })

  it('na przykładzie znajduje lokal, dwóch właścicieli, służebność, hipotekę i wzmiankę', () => {
    const a = analizuj(PRZYKLAD)
    expect(a.numer).toBe('GD1G/00099999/0')
    expect(a.lokal.adres).toBe('GDAŃSK, ul. PRZYKŁADOWA 12/5')
    expect(a.lokal.powierzchnia).toBe('48,20 M2')
    expect(a.wlasciciele).toEqual([
      { nazwa: 'JAN PRZYKŁADOWY', udzial: '1/2' },
      { nazwa: 'ANNA PRZYKŁADOWA', udzial: '1/2' },
    ])
    expect(a.hipoteki).toEqual([{ suma: '420 000,00', waluta: 'ZŁ', wierzyciel: 'BANK PRZYKŁADOWY SPÓŁKA AKCYJNA' }])
    expect(tytuly(PRZYKLAD)).toEqual(
      expect.arrayContaining(['Właścicieli jest 2', 'Wspólność małżeńska', 'Służebność osobista', 'Hipotek: 1', 'Wzmianki o wnioskach: 1']),
    )
    expect(a.brakujaceDzialy).toEqual([])
  })

  it('pusta księga daje zielone flagi dla działów III i IV', () => {
    const czysta = `DZIAŁ I-O\nUlica\tDŁUGA\nDZIAŁ II\nImię pierwsze\tJAN\nNazwisko\tNOWAK\nDZIAŁ III\nBrak wpisów\nDZIAŁ IV\nBrak wpisów`
    const a = analizuj(czysta)
    expect(a.flagi.filter((f) => f.waga !== 'ok')).toEqual([])
    expect(tytuly(czysta)).toEqual(['Dział III bez wpisów', 'Brak hipotek'])
  })

  it('nazwy działów i rubryk nie uruchamiają flag (pusta księga w układzie z przeglądarki)', () => {
    const pustaZNaglowkami = [
      'DZIAŁ I-O - OZNACZENIE NIERUCHOMOŚCI', 'Ulica\tDŁUGA',
      'DZIAŁ II - WŁASNOŚĆ', 'Imię pierwsze\tJAN', 'Nazwisko\tNOWAK',
      'DZIAŁ III - PRAWA, ROSZCZENIA I OGRANICZENIA', 'Rubryka 3.1 - Ostrzeżenia', 'Rubryka 3.2 - Ograniczone prawa rzeczowe', 'Rubryka 3.3 - Prawa osobiste i roszczenia',
      'DZIAŁ IV - HIPOTEKA', 'Rubryka 4.4 - Hipoteka',
    ].join('\n')
    const a = analizuj(pustaZNaglowkami)
    expect(a.hipoteki).toEqual([])
    expect(a.flagi.map((f) => f.tytul)).toEqual(['Dział III bez wpisów', 'Brak hipotek'])
  })

  it('egzekucja i dożywocie to ryzyko', () => {
    const t = `DZIAŁ III\nWZMIANKA O WSZCZĘCIU EGZEKUCJI PRZEZ KOMORNIKA\nPRAWO DOŻYWOCIA NA RZECZ OSOBY\nDZIAŁ IV\nBrak wpisów`
    const f = analizuj(t).flagi
    expect(f.filter((x) => x.waga === 'ryzyko').map((x) => x.tytul)).toEqual(['Egzekucja albo zajęcie', 'Prawo dożywocia'])
  })

  it('nieznany wpis w dziale III nie przechodzi po cichu', () => {
    expect(tytuly('DZIAŁ III\nJAKIŚ NIETYPOWY WPIS O TREŚCI X')).toContain('Wpis w dziale III')
  })

  it('zgłasza brakujące działy, gdy wklejono tylko część księgi', () => {
    expect(analizuj('DZIAŁ II\nImię pierwsze\tJAN').brakujaceDzialy).toEqual(['I-O', 'I-Sp', 'III', 'IV'])
  })
})
