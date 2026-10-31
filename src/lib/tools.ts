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
  href: string
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
    href: 'https://rejestr-cen-transakcyjnych.pl',
    external: true,
    status: 'dziala',
    audience: 'sprzedający, kupujący, agenci',
  },
  {
    id: 'protokol',
    name: 'Protokół z telefonu',
    lead: 'Wydanie i zwrot mieszkania w 10 minut.',
    description:
      'Zdjęcia z telefonu, stan liczników, porównanie było i jest, rozliczenie kaucji. Gotowy PDF dla obu stron.',
    href: 'https://d1uyku9msq0fvh.cloudfront.net/demo/',
    external: true,
    status: 'pokaz',
    audience: 'wynajmujący, najemcy, zarządcy',
  },
  {
    id: 'ksiega-wieczysta',
    name: 'Księga wieczysta po ludzku',
    lead: 'Co w księdze jest naprawdę ważne.',
    description:
      'Cztery działy przetłumaczone na zwykły język: właściciel, obciążenia, hipoteki, ostrzeżenia. Przed podpisaniem czegokolwiek.',
    href: '/narzedzia/ksiega-wieczysta',
    external: false,
    status: 'pokaz',
    audience: 'kupujący, najemcy, agenci',
  },
  {
    id: 'spacer-3d',
    name: 'Spacer 3D z rzutu',
    lead: 'Rzut mieszkania zamienia się w spacer.',
    description:
      'Wgraj rzut z ogłoszenia, przejdź przez pokoje, zobacz metraż i wycenę z rejestru cen.',
    href: 'https://akademia-ai-nieruchomosci.pl/spacer-3d/',
    external: true,
    status: 'dziala',
    audience: 'sprzedający, agenci',
  },
  {
    id: 'studio',
    name: 'Property Intelligence Studio',
    lead: 'Jedna teczka na jedną nieruchomość.',
    description:
      'Dokumenty, fakty z dowodami, braki i decyzje w jednym miejscu. Tu trafią wyniki pozostałych narzędzi.',
    href: '/nieruchomosci',
    external: false,
    status: 'dziala',
    audience: 'agenci, biura',
  },
]
