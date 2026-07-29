# Property Intelligence Studio: pełny odbiór obecnego release'u

Status: zaakceptowany kierunek, specyfikacja do odbioru przed planem wdrożenia  
Data: 2026-07-29

## 1. Decyzja

Przed rozpoczęciem kolejnych modułów roadmapy domykamy cały obecny release
Property Intelligence Studio i otaczającej go platformy Akademii AI.

Etap obejmuje:

- uwierzytelnianie i sesję użytkownika;
- onboarding Express, Deep oraz obie ścieżki person;
- profil użytkownika i kontekst przekazywany agentom;
- wszystkich sześciu agentów AI, w tym agenta prawnego z RAG;
- obecne funkcje Studio M1-M2;
- panel administratora;
- eksport i usunięcie konta;
- izolację danych pomiędzy użytkownikami;
- czytelny tryb pilotażowy w miejscach związanych z płatnościami;
- powtarzalny odbiór przeglądarkowy i API na danych syntetycznych;
- produkcyjny smoke test oraz pełne sprzątanie zasobów syntetycznych.

Płatności Stripe nie są uruchamiane w tym etapie. Plot Future Lab, Offer
Launch Lab i Buyer Room pozostają osobnym etapem po odbiorze obecnego release'u.

## 2. Cel

Po zakończeniu etapu Darek ma otrzymać dowód, że wszystkie funkcje widoczne w
obecnym produkcie działają razem jako jeden przepływ użytkownika, a nie tylko
przechodzą odizolowane testy jednostkowe.

System ma potwierdzić, że:

1. użytkownik może wejść do produktu, ukończyć onboarding i wrócić do zapisanej
   pracy;
2. wygenerowany profil i persony są wykorzystywane przez agentów;
3. każdy dostępny agent odpowiada w granicach swojej roli;
4. agent prawny korzysta z kontrolowanego RAG i nie udaje, że znalazł przepis,
   gdy nie ma go w bazie;
5. teczka nieruchomości przechodzi pełny przepływ od utworzenia do weryfikacji
   źródła i propozycji;
6. dane jednego użytkownika nie są dostępne dla drugiego;
7. eksport obejmuje dane platformy, a usunięcie syntetycznego konta usuwa jego
   dane i zasoby;
8. administrator może odwracalnie sterować dostępnością agentów;
9. brak Stripe nie prowadzi do błędnych przycisków, błędów 500 ani obietnicy
   działającej płatności;
10. po teście nie pozostają konta, rekordy, obiekty S3 ani zmienione ustawienia
    administratora.

## 3. Granice etapu

### W zakresie

- obecny produkcyjny frontend i API;
- Cognito, PostgreSQL, Vercel KV, Anthropic, Pinecone oraz produkcyjny pipeline
  źródeł w AWS;
- minimalne poprawki funkcjonalne i UX wykryte przez odbiór;
- testy kontraktowe, integracyjne i przeglądarkowe;
- dwa lub więcej izolowanych użytkowników syntetycznych;
- syntetyczne profile, persony, prompty i nieruchomości;
- jeden mały dokument syntetyczny do produkcyjnego testu źródeł;
- kontrolowany test panelu administratora z natychmiastowym przywróceniem
  poprzedniego stanu;
- produkcyjny deploy przez istniejący przepływ Vercel;
- raport odbioru bez sekretów i bez treści odpowiedzi użytkownika.

### Poza zakresem

- aktywacja Stripe, tworzenie produktów, cen, webhooków i pobieranie płatności;
- zmiana publicznych cen albo modelu biznesowego;
- prawdziwe dane Wojtka, agentów, klientów lub nieruchomości;
- Plot Future Lab;
- Offer Launch Lab;
- Buyer Room;
- multi-user i white-label obiecywane docelowo dla planu Agency;
- zmiana dostawcy modeli AI;
- szeroki redesign istniejącego interfejsu;
- migracje destrukcyjne i usuwanie danych innych niż zasoby dedykowanych kont
  syntetycznych.

## 4. Wybrana architektura odbioru

Wybieramy powtarzalny harness E2E oparty na przeglądarce i API, rozszerzający
istniejący mechanizm `production-synthetic`. Nie tworzymy drugiego niezależnego
systemu sprzątania.

Harness ma trzy warstwy:

1. **Testy kontraktowe i integracyjne** — szybkie testy endpointów, uprawnień,
   trybu pilotażowego oraz adapterów zewnętrznych.
2. **Test przeglądarkowy** — rzeczywiste przejście przez interfejs użytkownika,
   z selektorami opartymi na rolach i dostępnych nazwach.
3. **Produkcyjny smoke test** — minimalny przebieg na syntetycznych kontach z
   kontrolą AWS, Vercel, bazy, kolejek i alarmów.

Preferowanym narzędziem przeglądarkowym jest Playwright. Testy produkcyjne nie
wchodzą do zwykłego `npm test`, aby przypadkowy lokalny test nie tworzył kont,
nie wywoływał modeli i nie generował kosztu.

## 5. Scenariusze odbiorowe

### 5.1. Uwierzytelnianie i sesja

Użytkownik A przechodzi rzeczywisty ekran rejestracji. Jeżeli Cognito wymaga
kodu wysłanego na niedostarczalny adres syntetyczny, harness potwierdza konto
kontrolowaną operacją operatorską i wraca do UI. Użytkownik B może zostać
utworzony bezpośrednio przez tę samą ścieżkę operatorską. Hasła, kody i tokeny
nie trafiają do logów.

Test potwierdza:

- walidację formularza rejestracji;
- utworzenie użytkownika przez formularz;
- potwierdzenie konta i przejście do logowania;
- logowanie poprawnymi danymi;
- odrzucenie błędnego hasła bez ujawnienia szczegółów konta;
- utworzenie sesji aplikacyjnej;
- utrzymanie sesji po odświeżeniu;
- wylogowanie i blokadę chronionych endpointów po wylogowaniu.

Jeżeli bieżący produkt wymaga zaproszenia, test używa dedykowanego zaproszenia
syntetycznego i potwierdza, że wejście bez niego jest zablokowane czytelnym
komunikatem.

### 5.2. Onboarding i profil

Do odbioru używamy dwóch syntetycznych użytkowników:

- użytkownik A przechodzi Express oraz Persona Path A;
- użytkownik B przechodzi Express oraz Persona Path B;
- Deep Wizard jest wykonywany dla jednego z nich po zapisaniu profilu
  podstawowego.

Test potwierdza:

- zapis odpowiedzi po każdym kroku;
- wznowienie po odświeżeniu;
- generowanie `profil.md`;
- generowanie persony kupującego i sprzedającego;
- dostępność wygenerowanych plików w profilu;
- reset tylko danych onboardingu bieżącego użytkownika;
- brak danych użytkownika A w sesji użytkownika B.

### 5.3. Zespół sześciu agentów

Każdy agent otrzymuje krótki, deterministyczny prompt syntetyczny powiązany z
profilem użytkownika. Test nie ocenia stylu słowo w słowo. Sprawdza:

- odpowiedź HTTP i poprawny kontrakt danych;
- niepustą odpowiedź modelu;
- użycie właściwego identyfikatora agenta i narzędzia;
- uwzględnienie bezpiecznego znacznika z profilu syntetycznego;
- brak treści należących do drugiego użytkownika;
- czytelny błąd dostawcy i brak sekretów w odpowiedzi.

Agent prawny otrzymuje dwa pytania:

- pytanie z odpowiedzią znajdującą się w indeksie prawnym;
- pytanie kontrolne bez jednoznacznej podstawy w indeksie.

Odbiór wymaga poprawnego wskazania źródła dla pierwszego pytania oraz jawnego
przyznania braku trafnego przepisu dla drugiego. Nie wymagamy identycznego
brzmienia odpowiedzi.

### 5.4. Studio M1-M2

Użytkownik A:

1. tworzy teczkę nieruchomości;
2. dodaje i edytuje fakt;
3. ustawia status oraz widoczność faktu;
4. dodaje mały dokument syntetyczny;
5. czeka na zakończenie walidacji i ekstrakcji;
6. otwiera źródło i propozycje;
7. akceptuje jedną propozycję i odrzuca drugą;
8. potwierdza widok braków lub konfliktów;
9. sprawdza historię zmian;
10. pobiera źródło przez krótkotrwały podpisany adres.

Użytkownik B próbuje odczytać zasoby użytkownika A przez UI i API. Każda próba
ma zakończyć się odpowiedzią 404 albo równoważną blokadą bez ujawnienia
istnienia zasobu.

### 5.5. Panel administratora

Test administratora:

- potwierdza odrzucenie błędnego hasła;
- loguje się bez utrwalania sekretu w raporcie;
- odczytuje status KV i listę agentów;
- zapisuje stan wybranego agenta;
- przełącza go na stan przeciwny;
- potwierdza zmianę w widoku użytkownika;
- w bloku `finally` przywraca dokładnie stan początkowy;
- potwierdza wylogowanie administratora.

Błąd przywrócenia stanu jest krytycznym błędem odbioru.

### 5.6. Eksport i usunięcie konta

Eksport użytkownika A musi zawierać jego:

- dane konta dostępne aplikacji;
- onboarding, profil i persony;
- stan subskrypcji pilotażowej;
- nieruchomości, fakty, źródła, propozycje i historię Studio.

Nie może zawierać danych użytkownika B, sekretów, podpisanych adresów ani
wewnętrznych danych uwierzytelniających.

Na końcu użytkownik A uruchamia usunięcie konta przez UI. Harness potwierdza
usunięcie rekordów aplikacyjnych, danych KV, użytkownika Cognito i wszystkich
wersji obiektów przypisanych do syntetycznego przebiegu. Użytkownik B jest
usuwany kontrolowaną procedurą operatorską po zakończeniu testu izolacji.

### 5.7. Nawigacja i podstawowa użyteczność

Test przechodzi kluczowe widoki:

- start;
- profil;
- onboarding;
- lista i workspace agentów;
- lista i teczka nieruchomości;
- ustawienia konta;
- plan pilotażowy;
- panel administratora.

Krytyczne przepływy są sprawdzane na desktopie i w mobilnym viewportcie.
Odbiór wymaga braku niedostępnych akcji, poziomego przepełnienia, zasłoniętych
formularzy i ślepych ekranów ładowania. Interaktywne elementy muszą mieć
widoczny fokus oraz dostępną nazwę używaną przez test. Etap może poprawić
wykryte błędy użyteczności, ale nie zmienia kierunku wizualnego produktu.

## 6. Tryb pilotażowy bez Stripe

Brak skonfigurowanego Stripe jest jawnym stanem produktu, a nie ukrytym
fallbackiem.

W trybie pilotażowym:

- użytkownik ma dostęp do funkcji Pro zgodnie z obecną decyzją;
- ekran planu pokazuje, że dostęp pilotażowy jest aktywny;
- przyciski checkout i portal nie wykonują żądań do Stripe;
- UI nie obiecuje aktywnej płatności, faktur ani anulowania subskrypcji;
- endpointy Stripe bez konfiguracji zwracają kontrolowany status i bezpieczny
  komunikat, a nie błąd 500;
- stan pilotażowy jest objęty testami;
- późniejsza aktywacja Stripe pozostaje osobną decyzją biznesową i finansową.

Publiczne ceny nie są zmieniane w tym etapie.

## 7. Przepływ danych testowych

```text
manifest przebiegu syntetycznego
        │
        ├── użytkownik A ─► onboarding A ─► profil/persony
        │                         │
        │                         ├──► 6 agentów + RAG
        │                         └──► Studio + źródło + ekstrakcja
        │
        ├── użytkownik B ─► onboarding B ─► test izolacji
        │
        ├── administrator ─► zmiana agenta ─► przywrócenie stanu
        │
        └── raport ─► eksport A ─► usunięcie A/B ─► weryfikacja sprzątania
```

Każdy przebieg ma unikalny `run-id`. Nazwy, adresy e-mail, identyfikatory
teczek, klucze KV i prefiksy S3 zawierają ten identyfikator, aby sprzątanie nie
mogło objąć zasobów spoza przebiegu.

## 8. Obsługa błędów

Harness zapisuje etap, kod błędu i bezpieczny identyfikator zasobu. Nie zapisuje:

- haseł;
- tokenów Cognito;
- cookies sesyjnych;
- kluczy API;
- treści profilu, person, promptów i odpowiedzi modeli;
- podpisanych adresów S3;
- wartości zmiennych środowiskowych.

Każda operacja zewnętrzna ma limit czasu i skończoną liczbę ponowień.
Ponowienie nie może tworzyć drugiego dokumentu, workflow ani propozycji.

Po pierwszym błędzie harness zatrzymuje nowe operacje kosztowe, ale nadal
wykonuje sprzątanie i weryfikację stanu końcowego.

## 9. Sprzątanie i odwracalność

Istniejący rejestr zasobów `production-synthetic` zostaje rozszerzony o konta,
klucze KV i stany administratora potrzebne do pełnego E2E.

W bloku `finally` harness:

1. przywraca zmienione ustawienie agenta;
2. usuwa syntetyczne dane użytkowników z PostgreSQL;
3. usuwa syntetyczne klucze KV;
4. usuwa użytkowników Cognito;
5. usuwa wszystkie wersje i delete markery obiektów spod dedykowanych
   prefiksów;
6. potwierdza brak aktywnych workflow dla przebiegu;
7. sprawdza DLQ, alarmy i błędy funkcji;
8. zachowuje wyłącznie zanonimizowany raport.

Sprzątanie nie używa szerokich prefiksów, wildcardów kont ani operacji
obejmujących niesyntetycznych użytkowników. Błąd sprzątania kończy odbiór
statusem niezerowym.

Rollback kodu odbywa się przez `git revert` commitów etapu. Zmiany w trybie
pilotażowym i testach są odwracalne. Baseline AWS, istniejący stack Studio,
baza produkcyjna i dane użytkowników nie są usuwane podczas rollbacku.

## 10. Koszt i limity

Pełny przebieg używa:

- po jednym krótkim wywołaniu każdego agenta;
- dwóch krótkich zapytań RAG;
- jednego małego dokumentu syntetycznego;
- istniejącej infrastruktury produkcyjnej.

Limit kosztu jednego pełnego odbioru wynosi 2 USD. Harness:

- estymuje koszt przed rozpoczęciem;
- zatrzymuje nowe wywołania modeli po osiągnięciu 1,50 USD;
- raportuje koszt modeli i pipeline bez wartości sekretów;
- wymaga osobnej zgody przed ponownym przebiegiem, jeżeli pierwszy przekroczy
  limit albo ujawni niekontrolowane zużycie.

## 11. Testy i bramki jakości

Implementacja jest prowadzona test-first. Minimalny zestaw bramek:

- testy kontraktów uwierzytelniania i sesji;
- testy stanu pilotażowego bez Stripe;
- testy routingu i izolacji danych;
- testy adapterów agentów i RAG z kontrolowanymi stubami;
- testy rejestru sprzątania;
- lokalny test Playwright na kontrolowanym środowisku;
- pełne `npm test`;
- pełne `npm run infra:test`;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- `npm audit --omit=dev`;
- `git diff --check`.

Produkcyjny E2E wymaga jawnego przełącznika, poprawnego hosta produkcyjnego,
potwierdzenia konta AWS `261965598943`, regionu `eu-central-1` i aktywnej sesji
MFA. Nie uruchamia się automatycznie w zwykłym CI.

## 12. Kryteria odbioru

Etap jest ukończony dopiero, gdy:

- wszystkie scenariusze 5.1-5.7 przechodzą;
- sześciu agentów zwraca poprawne odpowiedzi;
- RAG prawny przechodzi test pozytywny i negatywny;
- wszystkie operacje Studio użytkownika A są widoczne w jego historii;
- wszystkie próby dostępu użytkownika B do danych A są zablokowane;
- eksport A jest kompletny i nie zawiera danych B;
- usunięcie konta usuwa wszystkie zasoby syntetyczne A;
- zasoby syntetyczne B są usunięte przez cleanup;
- stan agenta zmieniony przez administratora jest przywrócony;
- tryb pilotażowy nie wykonuje żądań Stripe i nie pokazuje niedziałających
  akcji płatniczych;
- po przebiegu S3, PostgreSQL, Cognito i KV nie zawierają pozostałości run-id;
- DLQ jest pusta, alarmy nie są aktywne, a logi produkcyjne nie zawierają
  nowych nieobsłużonych błędów;
- wszystkie bramki jakości przechodzą;
- koszt odbioru nie przekracza 2 USD;
- raport zawiera wynik każdej funkcji, commit, deployment i potwierdzenie
  sprzątania bez danych wrażliwych.

## 13. Następny etap

Po odbiorze obecnego release'u rozpoczynamy osobny proces projektowy dla
pozostałej roadmapy:

1. Plot Future Lab;
2. Offer Launch Lab;
3. Buyer Room;
4. analityka i walidacja pilotażu.

Aktywacja płatności Stripe pozostaje niezależna od tej kolejności i wymaga
osobnej zgody Darka.
