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
  const system = `Jesteś asystentem AI który tworzy profil agenta nieruchomości.

Bierzesz 15 odpowiedzi z ankiety Express i generujesz uporządkowany dokument w formacie Markdown.

ZASADY:
- Pisz po polsku, naturalnie, bez korpomowy
- Nie wymyślaj danych których user nie podał, nie zgaduj. Pisz "nie podano" jeśli odpowiedź pusta
- Nie dopisuj zbędnych komentarzy, sekcji, ani metaopisów
- Konkretnie. Listy. Liczby gdzie są.
- Zachowaj imię, lokalizację, specjalizację 1:1 z odpowiedzi usera

FORMAT WYJŚCIA (ściśle według tego szablonu):

# PROFIL AGENTA NIERUCHOMOŚCI

## DANE PODSTAWOWE
- Imię: [imię]
- Wiek: [wiek]
- Lokalizacja: [miasto]
- Doświadczenie: [ile lat w nieruchomościach]
- Rynek: [miasto/region, typ nieruchomości, pierwotny/wtórny]
- Model pracy: [solo / biuro / zespół]

## KOMPETENCJE
- Supermoce (TOP 3):
  1. [punkt]
  2. [punkt]
  3. [punkt]
- Narzędzia: [lista]
- Poziom AI: [początkujący/średni/zaawansowany]

## CODZIENNA PRACA
- Aktywne oferty: [liczba]
- Transakcje/miesiąc: [obecne] -> cel [cel]
- Źródła klientów: [lista]
- Najwięksi pożeracze czasu: [lista]
- Główne frustracje: [lista]

## CELE I KIERUNEK
- Co chcę zmienić: [opis]
- Gdyby AI mogło zdjąć jedną rzecz: [opis]
- Czerwone linie: [lista czego NIE chce robić]

## INSTRUKCJE DLA AI
- Zawsze uwzględniaj mój rynek i specjalizację
- Pamiętaj o ograniczeniach czasowych (mam limit czasu)
- Priorytetyzuj działania które oszczędzają czas na powtarzalnych zadaniach
- Nigdy nie proponuj działań z listy "czerwonych linii"
- Dopasuj ton do mojego stylu pracy

KONIEC FORMATU. Nie dopisuj nic poza tym szablonem.`

  const answersBlock = expressQuestions
    .map((q, i) => {
      const a = answers[q.id]?.trim() ?? ''
      return `${i + 1}. ${q.prompt}\n   ODPOWIEDŹ: ${a || '(brak odpowiedzi)'}`
    })
    .join('\n\n')

  const user = `Oto 15 odpowiedzi agenta na ankietę Express:

${answersBlock}

Wygeneruj profil.md ściśle według formatu z system prompta.`

  return { system, user }
}
