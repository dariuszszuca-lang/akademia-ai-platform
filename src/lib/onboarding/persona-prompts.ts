import { getPersonaQuestions } from '@/data/onboarding/persona-questions'

/**
 * Buduje system + user prompt do generowania persona-{kupujacy|sprzedajacy}.md
 * po Path B (linearne 6 pytan).
 *
 * Wstrzykuje profil.md (zeby AI znalo agenta) + 6 odpowiedzi.
 */
export function buildGeneratePersonaPrompt(
  type: 'buyer' | 'seller',
  profilMd: string,
  answers: Record<string, string>,
): { system: string; user: string } {
  const isBuyer = type === 'buyer'
  const personaLabel = isBuyer ? 'KUPUJĄCEGO' : 'SPRZEDAJĄCEGO'
  const verb = isBuyer ? 'kupuje' : 'sprzedaje'
  const verb2 = isBuyer ? 'kupna' : 'sprzedaży'

  const system = `Jesteś asystentem AI który tworzy personę klienta agenta nieruchomości.

Bierzesz profil agenta (kim jest, jaki rynek obsługuje) i 6 odpowiedzi o jego rzeczywistych klientach. Generujesz uporządkowany dokument w formacie Markdown.

ZASADY:
- Pisz po polsku, naturalnie, językiem klienta (nie korpomowy)
- Bazuj WYŁĄCZNIE na tym co agent powiedział. Nie wymyślaj postaci. Jeśli czegoś brakuje, pisz "(do uzupełnienia po kolejnych transakcjach)"
- Imię persony nadaj symboliczne, opisowe (np. "Anna i Tomek, młoda rodzina szukająca M3", a nie "Klient X")
- W cytatach używaj DOKŁADNYCH słów z odpowiedzi agenta jeśli podał
- Tabele rób w czystym Markdown (| pipes |)
- Konkretnie. Krótko. Bez wodolejstwa.

FORMAT WYJŚCIA (ściśle według tego szablonu, nic poza nim):

# PERSONA ${personaLabel}: [opisowa nazwa, np. "Anna i Tomek, młoda rodzina"]

## KIM JEST
- Wiek, sytuacja rodzinna, lokalizacja: [konkrety]
- Zawód / sytuacja finansowa: [konkrety]
- Powód ${verb2}: [co się wydarzyło w życiu]
- Doświadczenie z nieruchomościami: [pierwszy raz / kolejna transakcja]
- Gdzie szuka informacji: [portale, social media, znajomi]

## SYTUACJA
- Co ${verb}: [typ nieruchomości, parametry]
- Budżet / oczekiwana cena: [zakres]
- Deadline: [czy się spieszy, dlaczego]
- Kto podejmuje decyzję: [sam / para / rodzina]

## CELE (co chce osiągnąć?)
1. [Cel 1]
2. [Cel 2]
3. [Cel 3]

## PROBLEMY I PRAGNIENIA

| Co go boli | Czego pragnie |
|---|---|
| [Problem 1] | [Pożądany stan 1] |
| [Problem 2] | [Pożądany stan 2] |
| [Problem 3] | [Pożądany stan 3] |

## WYZWALACZE (co sprawia że zaczyna szukać agenta)
- [Wyzwalacz 1]
- [Wyzwalacz 2]
- [Wyzwalacz 3]

## OBIEKCJE I ODPOWIEDZI

| Obiekcja | Twoja odpowiedź |
|---|---|
| "[Obiekcja 1]" | [Krótka odpowiedź adresująca obawę] |
| "[Obiekcja 2]" | [Krótka odpowiedź] |
| "[Obiekcja 3]" | [Krótka odpowiedź] |

## JĘZYK I TON KOMUNIKACJI
Słowa które rezonują:
- [Fraza 1]
- [Fraza 2]
- [Fraza 3]

Czego unikać: [żargon, presja, fałszywe obietnice]

## 3 CYTATY TEJ PERSONY
1. "[Cytat pokazujący główny problem]"
2. "[Cytat pokazujący obawę]"
3. "[Cytat pokazujący czego naprawdę chce]"

## INSTRUKCJE DLA AI
- Używaj języka tej persony w opisach ofert, postach social, mailach
- Adresuj jej obawy w komunikacji
- Używaj wyzwalaczy jako hooków w postach i reklamach
- Nie używaj słów z listy "czego unikać"

KONIEC FORMATU. Nie dopisuj nic poza tym szablonem.`

  const questions = getPersonaQuestions(type)
  const answersBlock = questions
    .map((q, i) => {
      const a = answers[q.id]?.trim() ?? ''
      return `${i + 1}. ${q.prompt}\n   ODPOWIEDŹ: ${a || '(brak odpowiedzi)'}`
    })
    .join('\n\n')

  const user = `Oto profil agenta nieruchomości:

${profilMd}

---

A oto 6 odpowiedzi tego agenta o jego rzeczywistych klientach ${isBuyer ? 'kupujących' : 'sprzedających'}:

${answersBlock}

Wygeneruj persona-${isBuyer ? 'kupujacy' : 'sprzedajacy'}.md ściśle według formatu z system prompta.`

  return { system, user }
}
