import { expressQuestions } from '@/data/onboarding/express'
import { deepQuestions } from '@/data/onboarding/deep'
import type { ExpressAnswers, DeepAnswers } from './types'

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

/**
 * Buduje prompt do rozszerzenia profil.md o sekcje Deep (po 20 pytaniach pogłębionych).
 * Bierze obecny profil.md i 20 odpowiedzi, dopisuje 4 nowe sekcje.
 */
export function buildExtendProfilWithDeepPrompt(
  currentProfilMd: string,
  deepAnswers: DeepAnswers,
): { system: string; user: string } {
  const system = `Jesteś asystentem AI który ROZSZERZA istniejący profil agenta nieruchomości o dodatkowe sekcje.

Bierzesz aktualny profil.md i 20 odpowiedzi z ankiety pogłębionej. Generujesz NOWY profil.md który zawiera WSZYSTKIE sekcje z oryginału plus 4 nowe sekcje na końcu (przed "INSTRUKCJE DLA AI").

ZASADY:
- Zachowaj 1:1 wszystkie istniejące sekcje (DANE PODSTAWOWE, KOMPETENCJE, CODZIENNA PRACA, CELE I KIERUNEK)
- Dodaj 4 nowe sekcje DOŚWIADCZENIE, JAK PRACUJESZ NA CO DZIEŃ, TWÓJ RYNEK, WARTOŚCI I KIERUNEK
- Sekcja INSTRUKCJE DLA AI ma być na samym końcu, możesz ją wzbogacić o szczegóły z deep
- Polski, naturalnie, bez korpomowy
- Nie wymyślaj danych których user nie podał
- Konkretnie. Listy. Liczby gdzie są.

FORMAT NOWYCH SEKCJI (dodawane przed INSTRUKCJE DLA AI):

## DOŚWIADCZENIE
- Tło zawodowe (przed nieruchomościami): [opis]
- Certyfikaty / kursy: [lista]
- Najlepsza transakcja: [krótki opis i czego nauczyła]
- Najtrudniejsza transakcja: [krótki opis i czego nauczyła]
- Model pracy: [solo / asystent / zespół]

## JAK PRACUJESZ NA CO DZIEŃ
- Typowy dzień: [skrót przebiegu]
- Najwięcej energii: [pora dnia]
- Reakcja na stres: [styl]
- Typ osobowości: [intro/ekstra + jak wpływa]
- Rutyna vs elastyczność: [preferencja]

## TWÓJ RYNEK
- Eksperckie dzielnice: [lista]
- Średni czas sprzedaży: [dni]
- Baza klientów: [liczba w CRM, % aktywnych, skąd przychodzą]
- Kanały: [lista co działa, co nie]
- Główna konkurencja: [krótka analiza]

## WARTOŚCI I KIERUNEK
- 3 najważniejsze wartości: [lista z opisem]
- Definicja sukcesu: [opis]
- Wizja na 3 lata: [opis]
- Czerwone linie (uzupełnione): [lista]
- Zmiana w branży: [opis]

KONIEC FORMATU NOWYCH SEKCJI. Zwróć cały profil.md (stary + nowy). Nie dopisuj nic poza tym.`

  const answersBlock = deepQuestions
    .map((q, i) => {
      const a = deepAnswers[q.id]?.trim() ?? ''
      return `${i + 1}. ${q.prompt}\n   ODPOWIEDŹ: ${a || '(brak odpowiedzi)'}`
    })
    .join('\n\n')

  const user = `OBECNY PROFIL:

${currentProfilMd}

---

ODPOWIEDZI Z ANKIETY POGŁĘBIONEJ (20 pytań):

${answersBlock}

Zwróć NOWY pełny profil.md (stary + 4 dodane sekcje).`

  return { system, user }
}
