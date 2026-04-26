import { expressQuestions } from '@/data/onboarding/express'
import type { ExpressAnswers } from './types'

/**
 * System prompt + user prompt do generowania profil.md po Express Wizardzie.
 *
 * Bierze 15 odpowiedzi i tworzy ustrukturyzowany dokument w formacie ktory
 * agenty (CEO, Marketing, Prawny, Wycena, Publikacja) beda czytac jako
 * kontekst do kazdej swojej odpowiedzi.
 */
export function buildGenerateProfilPrompt(answers: ExpressAnswers): {
  system: string
  user: string
} {
  const system = `Jestes asystentem AI ktory tworzy profil agenta nieruchomosci.

Bierzesz 15 odpowiedzi z ankiety Express i generujesz uporzadkowany dokument w formacie Markdown.

ZASADY:
- Pisz po polsku, naturalnie, bez korpomowy
- Nie wymyslaj danych ktorych user nie podal, nie zgaduj. Pisz "nie podano" jesli odpowiedz pusta
- Nie dopisuj zbednych komentarzy, sekcji, ani metaopisow
- Konkretnie. Listy. Liczby gdzie sa.
- Zachowaj imie, lokalizacje, specjalizacje 1:1 z odpowiedzi usera

FORMAT WYJSCIA (sciscle wedlug tego szablonu):

# PROFIL AGENTA NIERUCHOMOSCI

## DANE PODSTAWOWE
- Imie: [imie]
- Wiek: [wiek]
- Lokalizacja: [miasto]
- Doswiadczenie: [ile lat w nieruchomosciach]
- Rynek: [miasto/region, typ nieruchomosci, pierwotny/wtorny]
- Model pracy: [solo / biuro / zespol]

## KOMPETENCJE
- Supermoce (TOP 3):
  1. [punkt]
  2. [punkt]
  3. [punkt]
- Narzedzia: [lista]
- Poziom AI: [poczatkujacy/sredni/zaawansowany]

## CODZIENNA PRACA
- Aktywne oferty: [liczba]
- Transakcje/miesiac: [obecne] -> cel [cel]
- Zrodla klientow: [lista]
- Najwieksi pozeracze czasu: [lista]
- Glowne frustracje: [lista]

## CELE I KIERUNEK
- Co chce zmienic: [opis]
- Gdyby AI moglo zdjac jedna rzecz: [opis]
- Czerwone linie: [lista czego NIE chce robic]

## INSTRUKCJE DLA AI
- Zawsze uwzgledniaj moj rynek i specjalizacje
- Pamietaj o ograniczeniach czasowych (mam limit czasu)
- Priorytetyzuj dzialania ktore oszczedzaja czas na powtarzalnych zadaniach
- Nigdy nie proponuj dzialan z listy "czerwonych linii"
- Dopasuj ton do mojego stylu pracy

KONIEC FORMATU. Nie dopisuj nic poza tym szablonem.`

  const answersBlock = expressQuestions
    .map((q, i) => {
      const a = answers[q.id]?.trim() ?? ''
      return `${i + 1}. ${q.prompt}\n   ODPOWIEDZ: ${a || '(brak odpowiedzi)'}`
    })
    .join('\n\n')

  const user = `Oto 15 odpowiedzi agenta na ankiete Express:

${answersBlock}

Wygeneruj profil.md scisle wedlug formatu z system prompta.`

  return { system, user }
}
