import { describe, expect, it } from 'vitest'
import { gotowyDoPodpisu, nowyProtokol, porownaj, rozliczKaucje, zwrotZWydania, type Protokol } from './domain'

function wydanie(): Protokol {
  const p = nowyProtokol('wydanie', new Date('2026-10-30T10:00:00Z'))
  p.adres = 'Gdańsk, ul. Szeroka 5/3'
  p.wynajmujacy = 'Anna'
  p.najemca = 'Piotr'
  p.kaucja = 5000
  p.liczniki = p.liczniki.map((l, i) => ({ ...l, stan: String(100 * (i + 1)) }))
  const kuchnia = p.pokoje.find((r) => r.nazwa === 'Kuchnia')!
  kuchnia.elementy.find((e) => e.nazwa === 'Lodówka')!.stan = 'zużycie'
  return p
}

describe('protokół: zwrot i porównanie z wydaniem', () => {
  it('zwrot kopiuje pokoje, liczniki i klucze z wydania, bez zdjęć i stanów liczników', () => {
    const w = wydanie()
    const z = zwrotZWydania(w)
    expect(z.typ).toBe('zwrot')
    expect(z.pokoje.map((p) => p.nazwa)).toEqual(w.pokoje.map((p) => p.nazwa))
    expect(z.liczniki.every((l) => l.stan === '')).toBe(true)
    expect(z.wydanie?.id).toBe(w.id)
    expect(z.wydanie?.wydanie).toBeUndefined()
    expect(z.kaucja).toBe(5000)
  })

  it('oddziela zwykłe zużycie od nowych szkód', () => {
    const w = wydanie()
    const z = zwrotZWydania(w)
    const pokoj = z.pokoje.find((p) => p.nazwa === 'Pokój')!
    pokoj.elementy.find((e) => e.nazwa === 'Podłoga')!.stan = 'zużycie'
    pokoj.elementy.find((e) => e.nazwa === 'Drzwi')!.stan = 'uszkodzenie'
    z.pokoje.find((p) => p.nazwa === 'Kuchnia')!.elementy.find((e) => e.nazwa === 'Lodówka')!.stan = 'dobry'

    const wynik = porownaj(w, z)
    const ocena = (pokoj: string, element: string) =>
      wynik.elementy.find((e) => e.pokoj === pokoj && e.element === element)!.ocena
    expect(ocena('Pokój', 'Podłoga')).toBe('zwykłe zużycie')
    expect(ocena('Pokój', 'Drzwi')).toBe('nowa szkoda')
    expect(ocena('Kuchnia', 'Lodówka')).toBe('lepiej niż przy wydaniu')
    expect(ocena('Łazienka', 'WC')).toBe('bez zmian')
    expect(wynik.noweSzkody.map((e) => e.element)).toEqual(['Drzwi'])
  })

  it('liczy zużycie liczników i brakujące klucze', () => {
    const w = wydanie()
    const z = zwrotZWydania(w)
    z.liczniki = z.liczniki.map((l, i) => ({ ...l, stan: i === 0 ? '1 350,5' : '' }))
    z.klucze[0].ilosc = 1
    const wynik = porownaj(w, z)
    expect(wynik.liczniki[0]).toMatchObject({ przed: 100, po: 1350.5, zuzycie: 1250.5 })
    expect(wynik.liczniki[1].zuzycie).toBeNull()
    expect(wynik.klucze[0]).toMatchObject({ przed: 2, po: 1, brakuje: 1 })
  })

  it('rozlicza kaucję: zwrot reszty albo dopłata', () => {
    expect(rozliczKaucje(5000, [{ id: '1', opis: 'drzwi', kwota: 1200 }, { id: '2', opis: 'klucz', kwota: 80.5 }])).toEqual({
      kaucja: 5000, potracenia: 1280.5, doZwrotu: 3719.5, doplata: 0,
    })
    expect(rozliczKaucje(1000, [{ id: '1', opis: 'kuchnia', kwota: 1500 }])).toMatchObject({ doZwrotu: 0, doplata: 500 })
    expect(rozliczKaucje(undefined, [])).toMatchObject({ kaucja: 0, doZwrotu: 0 })
  })

  it('przed podpisem wymaga adresu, stron i stanów liczników', () => {
    const p = nowyProtokol('wydanie')
    expect(gotowyDoPodpisu(p)).toEqual(expect.arrayContaining(['adres mieszkania', 'wynajmujący', 'najemca']))
    expect(gotowyDoPodpisu(wydanie())).toEqual([])
  })
})
