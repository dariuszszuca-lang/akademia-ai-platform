# Roadmapa Property Intelligence Studio

Data: 2026-07-26  
Horyzont pierwszej roadmapy: 2026-07-27 — 2026-12-20  
Status: propozycja wykonawcza do zatwierdzenia  
Właściciel biznesowy: Wojtek Lisiecki, Keller Williams, Poznań  
Właściciel produktu: Darek  
Właściciel techniczny: CTO

## 1. Cel

Do 20 grudnia 2026 uruchomić zamknięty, zmierzony pilotaż Property Intelligence
Studio, w którym agent:

1. zakłada teczkę prawdziwej nieruchomości,
2. zbiera i weryfikuje fakty oraz źródła,
3. widzi braki i sprzeczności przed publikacją,
4. dla działki tworzy oparty na danych scenariusz przyszłego wykorzystania,
5. generuje kampanię z blokadą zatwierdzonych faktów,
6. udostępnia kontrolowany Buyer Room zainteresowanym,
7. otrzymuje historię zmian, pytań i działań.

Roadmapa nie ma dowieźć „dużej liczby funkcji”. Ma odpowiedzieć na trzy pytania:

- Czy agenci wracają do pracy z teczką nieruchomości co tydzień?
- Czy system skraca przygotowanie oferty bez pogorszenia wiarygodności?
- Czy Plot Future Lab i warstwa zaufania tworzą przewagę, za którą warto płacić?

## 2. Wynik końcowy pilotażu

Poniższe liczby są proponowanymi progami decyzyjnymi, a nie obecnymi wynikami.

Do końca pilotażu chcemy osiągnąć:

| Obszar | Cel pilotażowy |
|---|---:|
| Aktywni agenci w pilotażu | 5 |
| Utworzone prawdziwe teczki | minimum 30 |
| Teczki doprowadzone do stanu `ready` | minimum 20 |
| Agenci aktywni w co najmniej 3 z ostatnich 4 tygodni | minimum 4 z 5 |
| Fakty publiczne ze źródłem albo jawnym potwierdzeniem agenta | minimum 90% |
| Zatwierdzone pakiety Offer Launch Lab | minimum 15 |
| Przetestowane działki w Plot Future Lab | minimum 10 |
| Udostępnione Buyer Rooms | minimum 10 |
| Zewnętrzne sesje w Buyer Room | minimum 50 |
| Krytyczne wycieki danych między użytkownikami | 0 |
| Materiały AI bez wymaganego oznaczenia | 0 |
| Agenci, którzy uznają utratę platformy za dotkliwą | minimum 4 z 5 |

Dodatkowo mierzymy zmianę czasu pracy. Przed pilotażem ustalamy baseline dla
każdego agenta. Celem jest:

- minimum 30% krótszy czas od zebrania materiałów do gotowego paszportu,
- minimum 50% krótszy czas przygotowania pierwszego kompletnego pakietu
  marketingowego,
- brak wzrostu liczby błędów faktograficznych w materiałach.

## 3. North Star Metric

Główna metryka:

> Liczba zweryfikowanych teczek nieruchomości z co najmniej jednym
> zatwierdzonym rezultatem na aktywnego agenta tygodniowo.

„Zatwierdzony rezultat” oznacza:

- teczkę przeprowadzoną do `ready`,
- zatwierdzony raport Plot Future Lab,
- zatwierdzony pakiet marketingowy,
- aktywowany Buyer Room.

Nie uznajemy samego logowania, liczby promptów ani liczby wygenerowanych plików
za dowód wartości.

## 4. Założenia wykonawcze

Daty obowiązują przy zespole:

- jeden główny wykonawca full-stack/AI,
- Darek dostępny do decyzji produktowych i odbiorów,
- Wojtek dostępny jako ekspert branżowy oraz lider pilotażu,
- wsparcie UI/UX w momentach projektowania nowych ekranów,
- pięciu agentów gotowych testować prawdziwe przypadki.

Jeżeli zespół lub dostępność danych będą mniejsze, nie obcinamy testów
bezpieczeństwa ani kontroli faktów. Przesuwamy datę kolejnego kamienia
milowego.

## 5. Zasady budowy

### 5.1. Pionowe rezultaty

Każdy kamień milowy kończy się działającym przepływem użytkownika, a nie samym
backendem, prototypem wizualnym albo zbiorem promptów.

### 5.2. Dane przed mediami

Najpierw budujemy teczkę i wiarygodność danych. Generowanie filmu, rolki lub
avatara zaczyna się dopiero wtedy, gdy źródło faktów działa na prawdziwych
ofertach.

### 5.3. Pilot przed skalą

Najpierw Poznań, Wojtek i mała grupa agentów. Ogólnopolska ekspansja,
automatyczna publikacja i rozbudowane integracje następują dopiero po
potwierdzeniu codziennej wartości.

### 5.4. Człowiek zatwierdza

AI proponuje, wykrywa i generuje. Człowiek potwierdza fakt, scenariusz i materiał
przed udostępnieniem.

### 5.5. Mierzymy od pierwszego releasu

Każdy przepływ ma zdarzenia produktowe, koszt wykonania, rezultat i status
akceptacji.

## 6. Mapa kamieni milowych

| Kamień | Termin | Rezultat |
|---|---|---|
| M0. Kontrakt pilotażu | 27.07–02.08 | próbki, baseline, grupa i decyzje UI |
| M1. Property Truth Engine | 03.08–23.08 | działająca teczka i paszport faktów |
| M2. Źródła i ekstrakcja | 24.08–13.09 | dokument → propozycje faktów → weryfikacja |
| M3. Pilot fundamentu | 14.09–27.09 | prawdziwe użycie i pierwsza bramka produktowa |
| M4. Plot Future Lab | 28.09–25.10 | działka → dane → scenariusze → raport i film |
| M5. Offer Launch Lab | 26.10–15.11 | teczka → kampania z blokadą faktów |
| M6. Buyer Room | 16.11–06.12 | kontrolowana prezentacja i obsługa pytań |
| M7. Walidacja i decyzja | 07.12–20.12 | raport pilotażu: skalujemy, poprawiamy albo zatrzymujemy |

## 7. M0 — Kontrakt pilotażu

Termin: 27 lipca — 2 sierpnia 2026

### Cel

Usunąć ryzyko budowania na wymyślonych przykładach i ustalić sposób mierzenia
wartości przed pierwszą zmianą produktową.

### Budujemy i przygotowujemy

- listę pięciu agentów pilotażowych,
- pięć zanonimizowanych przykładowych teczek:
  - dwa mieszkania,
  - jeden dom,
  - dwie działki,
- minimalny zestaw wymaganych faktów dla każdego typu,
- checklistę źródeł i dokumentów,
- trzy kierunki UI: paleta, typografia, layout i mood,
- zgodę na jeden kierunek UI,
- arkusz baseline czasu pracy,
- zasady anonimizacji i przetwarzania materiałów,
- listę danych, których nie wolno wysyłać do modeli AI.

### Pomiar baseline

Każdy agent wykonuje obecnym sposobem:

1. przygotowanie paszportu lub zestawu informacji o ofercie,
2. przygotowanie opisu,
3. przygotowanie koncepcji rolki i kampanii.

Zapisujemy:

- czas aktywnej pracy,
- liczbę użytych narzędzi,
- liczbę ręcznych przepisań tej samej informacji,
- liczbę wykrytych braków i poprawek,
- subiektywną trudność w skali 1–5.

### Kryterium wyjścia

- pięciu agentów potwierdzonych,
- pięć zanonimizowanych przypadków dostępnych,
- jeden zatwierdzony kierunek UI,
- baseline zapisany dla minimum trzech agentów,
- zatwierdzony zestaw pól paszportu mieszkania, domu i działki.

Jeżeli nie mamy przykładów i agentów, nie rozpoczynamy generowania mediów.

## 8. M1 — Property Truth Engine

Termin: 3–23 sierpnia 2026

### Cel

Stworzyć jedno źródło prawdy dla nieruchomości i sprawdzić, czy model faktów
pasuje do prawdziwej pracy agenta.

### Budujemy

- portfolio nieruchomości,
- zakładanie mieszkania, domu i działki,
- status procesu,
- paszport faktów,
- statusy:
  - potwierdzony,
  - deklarowany,
  - wywnioskowany,
  - sprzeczny,
  - brakujący,
  - niedotyczący,
- widoczność: wewnętrzna, dla klienta, publiczna,
- ręczne wskazanie źródła albo potwierdzającego,
- lista braków i konfliktów,
- historia zmian,
- izolacja organizacji i użytkowników,
- eksport oraz usunięcie danych,
- podstawowe zdarzenia analityczne.

### Nie budujemy

- uploadu plików,
- automatycznej ekstrakcji,
- wizualizacji,
- kampanii,
- publicznego Buyer Room.

### Mierzymy

- czas utworzenia pierwszej teczki,
- liczbę faktów na teczkę,
- udział faktów ze statusem innym niż domyślny,
- liczbę konfliktów wykrytych przez użytkownika,
- liczbę powrotów do tej samej teczki,
- błędy uprawnień i API.

### Kryterium wyjścia

- pięć przykładowych teczek odtworzonych w systemie,
- 100% zmian wartości i statusów ma wpis audytowy,
- 100% faktów ma status i pochodzenie,
- próba odczytu cudzej nieruchomości zwraca 404,
- eksport zawiera dane Studio,
- usunięcie konta usuwa dane Studio,
- testy, lint i build przechodzą,
- Wojtek akceptuje kategorie i statusy faktów.

Plan techniczny:
`docs/superpowers/plans/2026-07-26-property-truth-engine-foundation.md`.

## 9. M2 — Źródła i ekstrakcja

Termin: 24 sierpnia — 13 września 2026

### Cel

Zmienić paszport z ręcznego formularza w kontrolowany proces:
źródło → propozycja → weryfikacja → fakt.

### Budujemy

- bezpieczny upload PDF, obrazu i podstawowych formatów biurowych,
- obiektowy storage i politykę retencji,
- sumę kontrolną oraz metadane źródła,
- podgląd źródła,
- ekstrakcję tekstu,
- propozycje faktów z odwołaniem do strony lub fragmentu,
- kolejkę „do potwierdzenia”,
- akceptację, odrzucenie i korektę propozycji,
- wykrywanie dwóch różnych wartości tego samego faktu,
- transkrypcję krótkiej notatki głosowej,
- koszt i status każdego zadania AI,
- retry bez tworzenia duplikatu.

### Zestaw testowy

Minimum:

- 20 dokumentów i materiałów,
- 50 ręcznie oznaczonych faktów referencyjnych,
- dokumenty o różnej jakości,
- minimum pięć kontrolowanych sprzeczności.

### Mierzymy

- precyzję ekstrakcji jawnych wartości liczbowych i tekstowych,
- udział propozycji zaakceptowanych bez korekty,
- udział odrzuconych propozycji,
- koszt dokumentu,
- czas przetwarzania,
- liczbę sprzeczności wykrytych poprawnie,
- liczbę fałszywych konfliktów.

### Kryterium wyjścia

- minimum 90% jawnych faktów referencyjnych poprawnie odczytanych,
- 100% propozycji AI pozostaje niepotwierdzone do decyzji człowieka,
- każda propozycja wskazuje źródło i fragment,
- wszystkie pięć kontrolowanych sprzeczności jest widocznych,
- nieobsługiwany lub nieczytelny plik kończy się czytelnym stanem błędu,
- koszt i dostawca są zapisane dla każdego zadania,
- brak treści dokumentów w logach aplikacji.

Jeżeli dokładność nie osiąga progu, zawężamy obsługiwane dokumenty. Nie
kompensujemy słabej ekstrakcji bardziej kreatywnym modelem.

## 10. M3 — Pilot fundamentu

Termin: 14–27 września 2026

### Cel

Sprawdzić powtarzalne użycie Property Truth Engine przed inwestycją w efektowne
generowanie mediów.

### Przebieg

- pięciu agentów dostaje dostęp,
- każdy wprowadza minimum dwie prawdziwe nieruchomości,
- pierwsza teczka powstaje podczas obserwowanej sesji,
- druga bez prowadzenia,
- co tydzień zbieramy problemy, ale nie dodajemy funkcji bez wspólnego wzorca,
- poprawki krytyczne wdrażamy na bieżąco,
- na końcu mierzymy czas i porównujemy z baseline.

### Mierzymy

- aktywację,
- czas do pierwszego faktu,
- czas do `ready`,
- liczbę sesji na teczkę,
- tygodniowy powrót,
- udział faktów ze źródłem,
- liczbę braków znalezionych przed publikacją,
- pytania i momenty porzucenia.

### Kryterium wyjścia

- minimum 10 prawdziwych teczek,
- minimum 7 osiąga `ready`,
- minimum 4 z 5 agentów wraca w kolejnym tygodniu,
- minimum 80% faktów publicznych ma źródło albo potwierdzenie,
- medianowy czas przygotowania paszportu spada o minimum 30% względem baseline,
- brak incydentu krytycznego bezpieczeństwa,
- minimum 4 z 5 agentów chce użyć systemu dla kolejnej oferty.

### Bramka decyzyjna A

Jeżeli mniej niż trzech agentów wraca lub czas pracy nie spada, zatrzymujemy
Plot Future Lab. Najpierw naprawiamy rdzeń: model faktów, szybkość albo UX.

## 11. M4 — Plot Future Lab

Termin: 28 września — 25 października 2026

### Cel

Dowieźć wyróżniający proces dla działki:
dane oficjalne → jawne ograniczenia → scenariusze → wizualizacja i raport.

### Budujemy

- identyfikację działki i geometrię,
- adaptery do wybranych źródeł dla Poznania,
- zapis źródła, daty pobrania, licencji i zasięgu,
- mapę dostępności danych,
- rozdzielenie informacji:
  - potwierdzonej,
  - niejednoznacznej,
  - niedostępnej,
- trzy typy scenariusza:
  - bezpieczny,
  - optymalny,
  - aspiracyjny,
- checklistę założeń i pytań do specjalisty,
- plansze scenariusza,
- jeden format krótkiego filmu,
- manifest generacji,
- oznaczenie AI i wizualizacji koncepcyjnej,
- raport do udostępnienia po zatwierdzeniu.

### Nie budujemy

- ogólnopolskiego pokrycia,
- projektu architektonicznego,
- automatycznej opinii o możliwości zabudowy,
- deklaracji uzyskania pozwolenia,
- nieograniczonego edytora filmów.

### Zestaw testowy

- minimum 10 działek z Poznania i okolic,
- różne poziomy dostępności danych,
- minimum dwie działki z niepełnym pokryciem,
- ręczna weryfikacja przez Wojtka i wskazanego eksperta planistycznego lub
  architekta.

### Mierzymy

- poprawność przypisania źródła i działki,
- udział danych z jawną datą oraz zasięgiem,
- liczbę niepotwierdzonych tez w raporcie,
- czas przygotowania raportu,
- koszt wizualizacji i filmu,
- ocenę użyteczności przez agenta w skali 1–5,
- liczbę korekt przed zatwierdzeniem.

### Kryterium wyjścia

- 10 działek przetworzonych,
- minimum 8 z 10 map źródeł zaakceptowanych po weryfikacji eksperckiej,
- 100% raportów rozdziela fakty, założenia i braki,
- 100% materiałów generowanych ma oznaczenie,
- minimum 7 z 10 raportów otrzymuje ocenę użyteczności 4 lub 5,
- żadna wizualizacja nie jest możliwa do pobrania bez informacji, że jest
  koncepcyjna,
- znamy koszt i czas całego procesu dla każdej działki.

### Bramka decyzyjna B

Jeżeli pokrycie danych jest zbyt słabe, nie rozszerzamy generowania filmu.
Zmieniamy moduł w „Raport potencjału i pytań do weryfikacji”, zachowując
uczciwe wskazanie braków.

## 12. M5 — Fact-Locked Offer Launch Lab

Termin: 26 października — 15 listopada 2026

### Cel

Zmienić zatwierdzoną teczkę w kompletny pakiet marketingowy bez ponownego
wprowadzania danych i bez zmiany faktów.

### Budujemy

- wybór odbiorcy i celu kampanii,
- generator opisu portalowego,
- post, karuzelę i scenariusz rolki,
- jeden szablon filmu,
- plan kampanii,
- wiadomości follow-up,
- manifest użytych faktów i ich wersji,
- blokadę wartości zatwierdzonych,
- statusy: draft, do sprawdzenia, zatwierdzony, nieaktualny,
- automatyczne oznaczenie materiału jako nieaktualnego po zmianie użytego faktu,
- eksport pakietu.

Avatar pozostaje opcjonalnym formatem dostawcy, nie osobnym produktem.

### Mierzymy

- czas od wyboru teczki do pierwszego pakietu,
- udział materiałów zaakceptowanych po pierwszej korekcie,
- liczbę zmian stylistycznych,
- liczbę zmian faktograficznych,
- koszt pakietu,
- czas oszczędzony względem baseline.

### Kryterium wyjścia

- minimum 20 wygenerowanych pakietów,
- minimum 15 zatwierdzonych,
- minimum 90% materiałów bez błędu faktograficznego,
- 100% materiałów ma manifest wersji faktów,
- zmiana faktu oznacza zależny materiał jako wymagający ponownego sprawdzenia,
- medianowy czas przygotowania pakietu spada o minimum 50%,
- publikacja nadal wymaga działania człowieka.

### Bramka decyzyjna C

Jeżeli materiały często wymagają zmian faktograficznych, poprawiamy blokadę
faktów i strukturę danych. Nie rozwiązujemy problemu samą zmianą modelu.

## 13. M6 — Buyer Room

Termin: 16 listopada — 6 grudnia 2026

### Cel

Dać kupującemu dostęp do wiarygodnej, interaktywnej prezentacji oferty, a
agentowi przekazać pytania i sygnał gotowości do kontaktu.

### Budujemy

- bezpieczny publiczny token oferty,
- wybór faktów i mediów widocznych dla klienta,
- stronę oferty,
- rozmowę tekstową opartą wyłącznie na dopuszczonych danych,
- bezpieczne „nie mamy tej informacji”,
- cytowanie źródła przy odpowiedzi,
- rejestr pytań bez odpowiedzi,
- zgodę na przekazanie danych kontaktowych,
- prośbę o kontakt,
- podsumowanie sesji dla agenta,
- możliwość wyłączenia Buyer Room.

Głos jest dodatkiem po potwierdzeniu jakości wersji tekstowej.

### Mierzymy

- liczbę pokoi i sesji,
- liczbę pytań na sesję,
- udział odpowiedzi z przypisanym źródłem,
- pytania bez odpowiedzi,
- prośby o kontakt,
- czas reakcji agenta,
- próby uzyskania danych wewnętrznych.

### Kryterium wyjścia

- minimum 10 aktywnych Buyer Rooms,
- minimum 50 zewnętrznych sesji,
- minimum 95% udzielonych odpowiedzi ma wskazane źródło,
- 100% pytań bez podstawy w danych kończy się odmową zgadywania,
- 0 ujawnień pól wewnętrznych i dokumentów prywatnych,
- agent otrzymuje podsumowanie każdej prośby o kontakt,
- użytkownik może natychmiast wyłączyć publiczny dostęp.

## 14. M7 — Walidacja i decyzja o skalowaniu

Termin: 7–20 grudnia 2026

### Cel

Zamknąć pilotaż na danych, a nie na wrażeniu z demonstracji.

### Działania

- zebranie metryk całego lejka,
- wywiad końcowy z każdym agentem,
- porównanie z baseline,
- analiza błędów i odrzuconych generacji,
- analiza kosztu na teczkę, raport, pakiet i sesję,
- audyt bezpieczeństwa oraz oznaczeń AI,
- przegląd zależności od dostawców,
- lista funkcji używanych i nieużywanych,
- decyzja produktowa na pierwszy kwartał 2027.

### Warunki decyzji „skalujemy”

- minimum 4 z 5 agentów aktywnych w 3 z ostatnich 4 tygodni,
- minimum 20 teczek w stanie `ready`,
- minimum 4 z 5 agentów deklaruje, że utrata produktu byłaby dotkliwa,
- przygotowanie paszportu szybsze o minimum 30%,
- przygotowanie pakietu marketingowego szybsze o minimum 50%,
- minimum 90% faktów publicznych ma podstawę,
- brak krytycznego incydentu bezpieczeństwa,
- koszt jednostkowy każdego modułu jest zmierzony,
- Wojtek potwierdza wartość procesu dla zespołu.

### Możliwe decyzje

#### Skalujemy

Rozszerzamy pilotaż, przygotowujemy pricing i rozpoczynamy:

- Deal Risk Radar,
- zespoły i role organizacyjne,
- integrację z Command lub CRM,
- nowe miasta,
- kolejne formaty materiałów.

#### Poprawiamy rdzeń

Jeżeli użycie jest regularne, ale metryki czasu lub jakości nie przechodzą,
wybieramy jeden problem i prowadzimy kolejny ograniczony eksperyment.

#### Zawężamy

Jeżeli tylko Plot Future Lab albo Offer Launch Lab ma silne użycie, produkt
staje się wyspecjalizowanym narzędziem tego procesu.

#### Zatrzymujemy

Jeżeli agenci nie wracają mimo poprawnego działania i wdrożenia, nie dokładamy
integracji ani kolejnych modeli.

## 15. Kolejność zależności

```text
M0 Przypadki i baseline
          ↓
M1 Property Truth Engine
          ↓
M2 Źródła i ekstrakcja
          ↓
M3 Pilot fundamentu ── brak użycia ──→ poprawa rdzenia
          ↓
M4 Plot Future Lab
          ↓
M5 Offer Launch Lab
          ↓
M6 Buyer Room
          ↓
M7 Decyzja
```

M4, M5 i M6 nie mogą tworzyć własnych kopii faktów. Wszystkie korzystają z
Property Truth Engine.

## 16. Instrumentacja

Minimalne zdarzenia:

- `property.created`
- `property.stage_changed`
- `property.ready`
- `source.uploaded`
- `source.processed`
- `fact.proposed`
- `fact.confirmed`
- `fact.corrected`
- `fact.conflict_detected`
- `fact.conflict_resolved`
- `generation.started`
- `generation.failed`
- `generation.approved`
- `generation.rejected`
- `plot_report.approved`
- `buyer_room.activated`
- `buyer_room.opened`
- `buyer_room.question_unanswered`
- `buyer_room.handoff_requested`

Zdarzenie zawiera identyfikator organizacji, projektu, typ działania, czas,
status i koszt, ale nie zawiera treści dokumentu, faktu, promptu ani rozmowy.

## 17. Cotygodniowy rytm

### Poniedziałek

- przegląd metryk,
- wybór jednego celu tygodnia,
- potwierdzenie danych lub użytkowników potrzebnych do testu.

### Środa

- działające demo pionowego fragmentu,
- decyzje blokujące podejmowane przez Darka i Wojtka.

### Piątek

- test na prawdziwym przypadku,
- zapis wyniku, błędów i kosztu,
- decyzja: przyjmujemy, poprawiamy albo usuwamy.

Każdy tydzień kończy się działającym wynikiem możliwym do sprawdzenia przez
agenta.

## 18. Definition of Done dla każdej funkcji

Funkcja jest skończona dopiero, gdy:

1. ma opisany rezultat użytkownika,
2. działa na danych użytkownika, nie tylko na mocku,
3. respektuje izolację organizacji,
4. posiada testy reguł biznesowych,
5. ma stan loading, pusty, błędu i sukcesu,
6. działa na mobile i klawiaturze,
7. zapisuje wymagane zdarzenie pomiarowe,
8. nie loguje treści prywatnej,
9. ma opisane zachowanie po błędzie dostawcy,
10. przeszła test na prawdziwej nieruchomości,
11. ma zaakceptowany rezultat przez właściciela produktu,
12. build produkcyjny przechodzi.

## 19. Role i odpowiedzialności

| Rola | Odpowiedzialność |
|---|---|
| Darek | priorytety, akceptacja produktu, decyzje zakresowe |
| Wojtek | prawda branżowa, przypadki, pilotaż i ocena użyteczności |
| CTO | architektura, bezpieczeństwo, integracje, jakość wdrożenia |
| UI/UX | trzy kierunki, flow, dostępność i testy użyteczności |
| Agenci pilotażowi | prawdziwe dane, wykonywanie zadań i feedback |
| Ekspert zewnętrzny | weryfikacja granic planistycznych/prawnych, gdy wymagana |

Darek akceptuje zmianę kierunku. Wojtek nie zatwierdza samodzielnie decyzji
technicznych, a CTO nie zmienia pozycjonowania ani ceny.

## 20. Ryzyka i reakcje

| Ryzyko | Sygnał | Reakcja |
|---|---|---|
| Agenci nie wracają | mniej niż 3 tygodniowo aktywnych | zatrzymać media, naprawić rdzeń |
| Za dużo ręcznego uzupełniania | brak poprawy czasu | poprawić ekstrakcję i szablony faktów |
| Słabe pokrycie danych działek | raporty z dużą liczbą braków | zawęzić obszar lub zmienić obietnicę |
| Halucynacje w materiałach | korekty faktograficzne | wzmocnić blokadę i walidację |
| Wysoki koszt wideo | koszt przekracza ustalony limit | limity, kolejka, tańszy format lub provider |
| Vendor lock-in | logika zależna od jednego API | adaptery i manifesty dostawców |
| Dane wrażliwe | prywatna treść w logach lub modelu | zatrzymać flow, usunąć logi, ograniczyć payload |
| Compliance AI | brak oznaczenia lub oryginału | zablokować eksport materiału |
| Rozrost zakresu | funkcje bez powiązania z metryką | przenieść poza bieżący kamień |
| Brak API KW | niemożliwa integracja | eksport i adapter dopiero po oficjalnym dostępie |

## 21. Świadomie poza roadmapą do grudnia

- pełny CRM,
- automatyczne uruchamianie reklam,
- automatyczna publikacja na portalach,
- własny model obrazu lub wideo,
- pełna Polska w Plot Future Lab,
- zaawansowany avatar i klon głosu jako główna funkcja,
- wycena kredytowa,
- automatyczne opinie prawne,
- marketplace szablonów,
- zmiana cen i pakietów,
- white-label dla wielu sieci.

## 22. Najbliższa decyzja

Roadmapa zaczyna się od M0. Przed implementacją M1 Darek i Wojtek muszą
potwierdzić:

1. pięciu agentów pilotażowych,
2. pięć zanonimizowanych przypadków,
3. jeden kierunek UI,
4. mieszkanie, dom i działkę jako pierwsze szablony,
5. osobę, która może ekspercko zweryfikować raport działki.

