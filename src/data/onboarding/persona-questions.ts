/**
 * Persona Path B: 6 pytan dla agenta ktory zna swoich klientow.
 * Inne dla kupujacych vs sprzedajacych.
 */

export type PersonaQuestion = {
  id: string
  prompt: string
  helper?: string
  placeholder?: string
}

export const buyerQuestions: PersonaQuestion[] = [
  {
    id: 'pq1',
    prompt: 'Pomyśl o swoich ostatnich 3 klientach kupujących. Co mieli wspólnego?',
    helper: 'Wiek, sytuacja życiowa, powód zakupu (pierwsze mieszkanie, rodzina się powiększa, inwestycja, rozwód...)',
    placeholder: 'Anna 32, mąż 35, drugie dziecko w drodze, wynajmują od 5 lat...',
  },
  {
    id: 'pq2',
    prompt: 'Jaki budżet mieli i jaki typ nieruchomości szukali?',
    helper: 'Zakres cenowy, metraż, liczba pokoi, lokalizacja, rynek pierwotny czy wtórny',
    placeholder: '600-800 tys, mieszkania 50-65m², 2-3 pokoje, Wrzeszcz/Oliwa, wtórny',
  },
  {
    id: 'pq3',
    prompt: 'Jakie 3 rzeczy martwiły ich najbardziej?',
    helper: 'Np. "czy nie przepłacam", "ile to potrwa", "czy mieszkanie nie ma ukrytych wad"',
    placeholder: '1. Czy nie przepłacam\n2. Czy mieszkanie nie ma wad prawnych\n3. Czy szybko sprzedam jak coś nie wyjdzie',
  },
  {
    id: 'pq4',
    prompt: 'Jakie obiekcje słyszysz od nich najczęściej?',
    helper: 'Konkretne zdania jakie padają w rozmowach',
    placeholder: '"Sami znajdziemy bez agenta", "prowizja jest za wysoka", "poczekamy na niższą cenę"...',
  },
  {
    id: 'pq5',
    prompt: 'Skąd do Ciebie trafili?',
    helper: 'Otodom, polecenia, social media, billboard, własna strona, inne?',
    placeholder: '60% z poleceń znajomych, 30% z Otodom, 10% z mojego IG',
  },
  {
    id: 'pq6',
    prompt: 'Jak te osoby mówią o swoim problemie? Jakich słów używają?',
    helper: 'Jeśli pamiętasz konkretne zdania, super. Pisz dosłownie jak mówią',
    placeholder: '"Marzymy o swoim", "jak długo można siedzieć w wynajmie", "obawiam się że to za drogo"',
  },
]

export const sellerQuestions: PersonaQuestion[] = [
  {
    id: 'pq1',
    prompt: 'Pomyśl o swoich ostatnich 3 klientach sprzedających. Co mieli wspólnego?',
    helper: 'Wiek, sytuacja życiowa, powód sprzedaży (przeprowadzka, spadek, rozwód, upgrade...)',
    placeholder: 'Pani Krystyna 60+, dzieci wyszły, sprzedaje 80m² żeby kupić 50m²...',
  },
  {
    id: 'pq2',
    prompt: 'Jaką cenę oczekiwali i jaki typ nieruchomości sprzedawali?',
    helper: 'Cena, metraż, lokalizacja, stan, rynek',
    placeholder: '900 tys, 80m² 3-pokojowe, Oliwa, wtórny, wymaga remontu',
  },
  {
    id: 'pq3',
    prompt: 'Jakie 3 rzeczy martwiły ich najbardziej?',
    helper: 'Np. "ile to potrwa", "czy nie sprzedam za tanio", "czy agent jest tego wart"',
    placeholder: '1. Czy nie sprzedam taniej niż mogę\n2. Ile to potrwa\n3. Czy agent przyciągnie poważnych kupców',
  },
  {
    id: 'pq4',
    prompt: 'Jakie obiekcje słyszysz od nich najczęściej?',
    helper: 'Konkretne zdania jakie padają',
    placeholder: '"Prowizja za wysoka", "sam znajdę kupca", "poczekam aż cena wzrośnie"...',
  },
  {
    id: 'pq5',
    prompt: 'Skąd do Ciebie trafili?',
    helper: 'Polecenia, Otodom, ulotka w skrzynce, billboard, social, własna strona, inne?',
    placeholder: '70% polecenia, 20% sami zadzwonili po ulotce, 10% IG',
  },
  {
    id: 'pq6',
    prompt: 'Jak te osoby mówią o swoim problemie? Jakich słów używają?',
    helper: 'Jeśli pamiętasz dosłowne zdania, super',
    placeholder: '"Mieszkanie stoi puste, generuje koszty", "trzeba to zamknąć żeby ruszyć dalej"',
  },
]

export function getPersonaQuestions(type: 'buyer' | 'seller'): PersonaQuestion[] {
  return type === 'buyer' ? buyerQuestions : sellerQuestions
}
