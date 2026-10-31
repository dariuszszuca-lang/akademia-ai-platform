/**
 * Narzędzia platformy. Jedno źródło dla pulpitu „Moje narzędzia”.
 *
 * status:
 * - dziala: działający produkt pod własnym adresem,
 * - pokaz: makieta albo pokaz, bez zapisu danych,
 * - wkrotce: tylko zapowiedź.
 */
export type ToolStatus = 'dziala' | 'pokaz' | 'wkrotce'

export type Tool = {
  id: string
  name: string
  lead: string
  description: string
  /** podstrona narzędzia w platformie */
  href: string
  /** osobna, publiczna strona produktu (bez logowania), jeśli istnieje */
  standaloneHref?: string
  external: boolean
  status: ToolStatus
  audience: string
}

export const TOOL_STATUS_LABEL: Record<ToolStatus, string> = {
  dziala: 'działa',
  pokaz: 'pokaz',
  wkrotce: 'wkrótce',
}

export const TOOLS: Tool[] = [
  {
    id: 'rejestr-cen',
    name: 'Rejestr cen transakcyjnych',
    lead: 'Za ile naprawdę sprzedano obok.',
    description:
      'Ceny z aktów notarialnych, nie z ogłoszeń. Średnia za metr w okolicy, liczba transakcji, wycena z metrażu.',
    href: '/narzedzia/rejestr-cen',
    standaloneHref: 'https://rejestr-cen-transakcyjnych.pl',
    external: false,
    status: 'dziala',
    audience: 'sprzedający, kupujący, agenci',
  },
  {
    id: 'protokol',
    name: 'Protokół z telefonu',
    lead: 'Wydanie i zwrot mieszkania z telefonu.',
    description:
      'Pokój po pokoju: stan, zdjęcia, liczniki, klucze, podpisy obu stron. Przy zwrocie porównanie z dniem wydania i rozliczenie kaucji.',
    href: '/narzedzia/protokol',
    standaloneHref: '/protokol',
    external: false,
    status: 'dziala',
    audience: 'wynajmujący, najemcy, zarządcy',
  },
  {
    id: 'ksiega-wieczysta',
    name: 'Księga wieczysta po ludzku',
    lead: 'Co w księdze jest naprawdę ważne.',
    description:
      'Wklej treść księgi z serwisu Ministerstwa Sprawiedliwości. Dostaniesz właścicieli, obciążenia, hipoteki i listę pytań do sprzedającego.',
    href: '/narzedzia/ksiega-wieczysta',
    standaloneHref: '/ksiega-wieczysta',
    external: false,
    status: 'dziala',
    audience: 'kupujący, najemcy, agenci',
  },
  {
    id: 'spacer-3d',
    name: 'Spacer 3D z rzutu',
    lead: 'Rzut mieszkania zamienia się w spacer.',
    description:
      'Wgraj rzut z ogłoszenia, przejdź przez pokoje, zobacz metraż i wycenę z rejestru cen.',
    href: '/narzedzia/spacer-3d',
    standaloneHref: 'https://akademia-ai-nieruchomosci.pl/spacer-3d/',
    external: false,
    status: 'dziala',
    audience: 'sprzedający, agenci',
  },
  {
    id: 'umowa-najmu',
    name: 'Umowa najmu okazjonalnego',
    lead: 'Umowa z listą załączników i terminów.',
    description:
      'Kreator prowadzi przez strony, lokal, czynsz i kaucję. Pilnuje limitów z ustawy i przypomina o zgłoszeniu do urzędu skarbowego.',
    href: '/narzedzia/umowa-najmu',
    standaloneHref: '/umowa-najmu-okazjonalnego',
    external: false,
    status: 'dziala',
    audience: 'wynajmujący, najemcy',
  },
  {
    id: 'studio',
    name: 'Property Intelligence Studio',
    lead: 'Jedna karta na jedną nieruchomość.',
    description:
      'Dokumenty, fakty z dowodami, braki i decyzje w jednym miejscu. Tu trafią wyniki pozostałych narzędzi.',
    href: '/nieruchomosci',
    external: false,
    status: 'dziala',
    audience: 'agenci, biura',
  },
]

export function getTool(id: string): Tool | undefined {
  return TOOLS.find((tool) => tool.id === id)
}
