# M0 — pakiet startowy pilotażu

Data rozpoczęcia: 2026-07-27  
Cel zamknięcia M0: 2026-08-02  
Właściciel produktu: Darek  
Ekspert branżowy i lider pilotażu: Wojtek Lisiecki  
Właściciel techniczny: CTO

## Cel M0

Przygotować prawdziwe przypadki, ludzi i pomiar, zanim zaczniemy budować
Property Truth Engine.

M0 jest zamknięte dopiero wtedy, gdy mamy:

- pięciu agentów pilotażowych,
- pięć zanonimizowanych nieruchomości,
- baseline obecnego czasu pracy,
- zatwierdzone pola paszportu,
- wybrany kierunek UI,
- zasady bezpiecznego używania materiałów.

## Wynik tygodnia

| Rezultat | Kryterium |
|---|---|
| Grupa pilotażowa | 5 agentów z potwierdzonym udziałem |
| Przypadki | 2 mieszkania, 1 dom, 2 działki |
| Baseline | minimum 3 agentów wykonuje ten sam zestaw zadań |
| Paszporty | zaakceptowane pola mieszkania, domu i działki |
| UI | wybór A, B albo C |
| Prywatność | każda teczka ma potwierdzony sposób anonimizacji |

## Kolejność działań

### 1. Wojtek wybiera agentów

Każdy agent:

- prowadzi obecnie przynajmniej jedną ofertę,
- może poświęcić dwie sesje na start i krótkie testy tygodniowe,
- zgadza się pokazać realny proces pracy,
- nie musi być zaawansowany technicznie,
- może korzystać z materiałów po anonimizacji.

Do każdego uczestnika wypełniamy:
`docs/pilot/templates/AGENT-PILOT-CARD.md`.

### 2. Zespół wybiera pięć przypadków

Potrzebujemy:

- mieszkania z kompletnymi dokumentami,
- mieszkania z brakami albo sprzecznością,
- domu,
- działki z dobrym pokryciem danych,
- działki z niepełnym pokryciem danych.

Do każdej nieruchomości wypełniamy:
`docs/pilot/templates/PROPERTY-CASE-INTAKE.md`.

### 3. Mierzymy obecny proces

Minimum trzech agentów przygotowuje bez nowej platformy:

1. komplet informacji potrzebnych do ogłoszenia,
2. opis oferty,
3. scenariusz rolki,
4. szkic kampanii.

Mierzymy czas aktywnej pracy, liczbę użytych narzędzi, przepisywanie tych samych
danych i poprawki.

Arkusz:
`docs/pilot/templates/BASELINE-MEASUREMENT.md`.

### 4. Wojtek zatwierdza model paszportu

Na podstawie pięciu przypadków oznaczamy:

- pola wymagane zawsze,
- pola wymagane tylko dla danego typu nieruchomości,
- pola wewnętrzne,
- pola możliwe do pokazania klientowi,
- pola możliwe do publikacji,
- dokument albo osoba, która może potwierdzić wartość.

### 5. Darek wybiera kierunek UI

Dokument:
`docs/specs/2026-07-27-property-studio-ui-directions.md`.

Rekomendacja CTO: `A — Trust Studio`.

### 6. CTO sprawdza gotowość do M1

Przed rozpoczęciem kodu sprawdzamy:

- brak prawdziwych danych osobowych w repozytorium,
- zgodę na wykorzystanie każdego przypadku,
- komplet pięciu kart przypadków,
- wyniki baseline,
- decyzję UI,
- potwierdzenie modelu pól przez Wojtka.

## Zasady pracy z materiałami

- Do repozytorium nie trafiają akty notarialne, numery ksiąg, PESEL, podpisy,
  numery dokumentów ani dane kontaktowe klientów.
- Plik przykładowy musi być zanonimizowany przed analizą.
- Oryginał pozostaje poza repozytorium i ma wskazanego opiekuna.
- W karcie przypadku używamy kodu, np. `PILOT-M-01`.
- Agent wskazuje, czy materiał może trafić do zewnętrznego dostawcy AI.
- Brak zgody oznacza test ręczny albo użycie syntetycznego odpowiednika.
- Zrzuty ekranu i nagrania z testów nie mogą pokazywać danych innych klientów.

## Spotkanie startowe z Wojtkiem

Czas: 60 minut.

### Agenda

1. 10 min — cel pilotażu i granice projektu.
2. 15 min — wybór pięciu agentów.
3. 15 min — wybór pięciu nieruchomości.
4. 10 min — omówienie baseline.
5. 10 min — wybór kierunku UI i odpowiedzialności.

### Decyzje po spotkaniu

- lista agentów,
- kody nieruchomości,
- terminy sesji baseline,
- opiekun każdego materiału,
- kierunek UI,
- osoba weryfikująca raport działki.

## Definition of Done

- [ ] Pięć kart agentów ma status `potwierdzony`.
- [ ] Pięć kart nieruchomości ma komplet wymaganych informacji organizacyjnych.
- [ ] Minimum trzy pomiary baseline są zakończone.
- [ ] Wojtek zaakceptował zestaw pól dla trzech typów nieruchomości.
- [ ] Darek wybrał kierunek UI.
- [ ] Każdy przypadek ma zapisany poziom zgody i sposób anonimizacji.
- [ ] CTO potwierdził gotowość do rozpoczęcia M1.

## Następny etap

Po spełnieniu kryteriów rozpoczynamy M1 zgodnie z:
`docs/superpowers/plans/2026-07-26-property-truth-engine-foundation.md`.

