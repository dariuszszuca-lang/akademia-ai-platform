# Property Intelligence Studio — specyfikacja produktu

Data: 2026-07-26  
Status: kierunek zaakceptowany przez Darka, gotowy do rozpisania i wdrożenia etapami  
Właściciel biznesowy: Wojtek Lisiecki, Keller Williams, Poznań  
Produkt bazowy: Akademia AI

## 1. Decyzja produktowa

Akademia AI przestaje być przede wszystkim biblioteką wiedzy i zestawem ogólnych
asystentów. Staje się `Property Intelligence Studio`: systemem operacyjnym
konkretnej nieruchomości.

Centralnym obiektem produktu jest teczka nieruchomości. Agent dodaje adres lub
działkę, dokumenty, zdjęcia, nagrania i notatki. Platforma porządkuje fakty,
pokazuje braki i sprzeczności, a następnie wykorzystuje zatwierdzone dane do
tworzenia prezentacji, wizualizacji, kampanii i obsługi zainteresowanych.

Główna obietnica:

> Z surowych danych nieruchomości do wiarygodnej oferty i kompletnego planu
> sprzedaży — bez przepisywania informacji i bez halucynacji AI.

Zasada wyróżniająca:

> Najpierw dowód, potem efekt.

## 2. Problem, który rozwiązujemy

Agent pracuje dziś w wielu oddzielnych miejscach:

- dokumenty i rzuty otrzymuje mailem lub komunikatorem,
- zdjęcia i filmy trzyma na telefonie lub dysku,
- dane publiczne sprawdza w kilku serwisach,
- opis i materiały tworzy w narzędziach ogólnych,
- pytania klientów zapisuje w notatkach albo trzyma w pamięci,
- osobno planuje reklamę, prezentację, rolki i follow-up,
- nie ma jednego miejsca pokazującego, które informacje są potwierdzone.

Generatywna AI przyspiesza tworzenie materiałów, ale w obecnym modelu może
również powielać błędy, dopisywać cechy nieruchomości i tworzyć obrazy, których
odbiorca nie odróżnia od stanu rzeczywistego.

Platforma ma zamknąć cały proces wokół jednej, wersjonowanej teczki
nieruchomości.

## 3. Użytkownicy

### Użytkownik główny

Agent nieruchomości prowadzący własne oferty. W pilotażu: Wojtek i agenci
Keller Williams z Poznania.

### Użytkownicy kolejnych etapów

- lider zespołu sprawdzający jakość i kompletność ofert,
- marketingowiec przygotowujący materiały na podstawie danych agenta,
- kupujący korzystający z kontrolowanego pokoju oferty,
- sprzedający oglądający raport przygotowania i promocji oferty,
- administrator organizacji zarządzający dostępem i standardami.

### Główne zadania użytkownika

1. Szybko założyć teczkę nowej nieruchomości.
2. Ustalić, które informacje są pewne, sprzeczne lub nieznane.
3. Zobaczyć listę braków przed publikacją.
4. Wygenerować materiały, które nie zmieniają faktów.
5. Pokazać klientowi przyszły potencjał nieruchomości bez udawania, że
   wizualizacja jest projektem lub stanem istniejącym.
6. Zebrać pytania i sygnały zainteresowania kupujących.
7. Zachować historię zmian i decyzji.

## 4. Zasady produktu

### 4.1. Jedna nieruchomość, jedna pamięć

Każdy materiał i działanie korzysta z tej samej teczki. Agent nie przepisuje
ponownie adresu, metrażu, ceny i cech lokalu do każdego generatora.

### 4.2. Fakty mają pochodzenie

Każda istotna informacja ma:

- wartość,
- status wiarygodności,
- źródło,
- autora lub proces, który ją dodał,
- datę ostatniej zmiany,
- opcjonalny fragment dokumentu lub adres źródła.

### 4.3. AI nie zatwierdza własnych wniosków

AI może zaproponować fakt albo wykryć konflikt, ale informacja wywnioskowana nie
staje się automatycznie informacją potwierdzoną. Zmiana statusu na
`potwierdzony` wymaga źródła lub świadomej decyzji człowieka.

### 4.4. Publikacja zawsze wymaga człowieka

W MVP platforma nie publikuje automatycznie ogłoszeń, reklam ani postów. Agent
zatwierdza końcowy materiał i eksportuje go lub kopiuje.

### 4.5. Wizualizacja nie udaje dokumentacji

Materiały pokazujące remont, zabudowę lub zmianę przeznaczenia są jednoznacznie
oznaczone jako koncepcja. Platforma zachowuje oryginalny materiał i manifest
generacji.

### 4.6. Brak danych jest informacją

Platforma pokazuje brak zasięgu źródła albo brak potwierdzenia. Nie zastępuje
brakującej informacji domysłem modelu.

## 5. Architektura produktu

```text
Property Intelligence Studio
│
├── Portfolio
│   ├── lista nieruchomości
│   ├── status przygotowania
│   └── ostatnie działania
│
├── Property Truth Engine
│   ├── paszport nieruchomości
│   ├── źródła i dokumenty
│   ├── braki i konflikty
│   ├── media oryginalne
│   └── historia zmian
│
├── Plot Future Lab
│   ├── dane planistyczne i przestrzenne
│   ├── scenariusze wykorzystania
│   ├── wizualizacje i film
│   └── raport dla kupującego
│
├── Offer Launch Lab
│   ├── opis i warianty komunikacji
│   ├── rolki, karuzele i filmy
│   ├── kampania i harmonogram
│   └── pakiet dla właściciela
│
├── Buyer Room
│   ├── strona lub QR oferty
│   ├── rozmowa oparta na teczce
│   ├── pytania i kwalifikacja
│   └── przekazanie rozmowy agentowi
│
├── Deal Risk Radar
│   ├── kompletność dokumentów
│   ├── terminy i następne działania
│   ├── konflikty danych
│   └── sprawy do konsultacji
│
└── Academy & Coach
    ├── istniejące materiały i warsztaty
    ├── trening na prawdziwej ofercie
    └── analiza rozmowy i obiekcji
```

## 6. Moduł 1: Property Truth Engine

To wymagany fundament wszystkich kolejnych modułów.

### 6.1. Portfolio

Widok wszystkich nieruchomości użytkownika:

- nazwa robocza i miniatura,
- typ nieruchomości,
- miejscowość i dzielnica,
- etap pracy,
- wskaźnik kompletności danych,
- liczba konfliktów i braków,
- ostatnia aktywność,
- skrót do dodania nowej nieruchomości.

Etapy pracy:

- `draft` — teczka założona,
- `collecting` — zbieranie danych,
- `verification` — wyjaśnianie braków i konfliktów,
- `ready` — gotowa do tworzenia materiałów,
- `marketing` — aktywna promocja,
- `under_offer` — oferta w procesie transakcyjnym,
- `closed` — proces zakończony,
- `archived` — archiwum.

### 6.2. Zakładanie nieruchomości

Minimalny formularz:

- nazwa robocza,
- typ: mieszkanie, dom, działka, lokal, obiekt komercyjny, inny,
- rodzaj procesu: sprzedaż lub najem,
- miejscowość,
- opcjonalny adres,
- opcjonalny identyfikator działki,
- zgoda na przetwarzanie dodawanych danych.

Adres nie może być wymagany dla oferty poufnej. Użytkownik może podać wyłącznie
lokalizację przybliżoną.

### 6.3. Paszport nieruchomości

Kategorie faktów:

- identyfikacja i lokalizacja,
- cena i warunki,
- powierzchnie,
- stan prawny,
- budynek i konstrukcja,
- pomieszczenia i układ,
- instalacje i media,
- standard i wyposażenie,
- otoczenie i komunikacja,
- działka i planowanie,
- koszty utrzymania,
- dostępność i terminy,
- informacje marketingowe,
- własne pola organizacji.

Statusy faktu:

- `confirmed` — potwierdzony źródłem lub ręcznie przez agenta,
- `declared` — deklaracja właściciela lub innej osoby,
- `inferred` — wniosek AI albo człowieka wymagający weryfikacji,
- `conflicting` — co najmniej dwa źródła podają różne wartości,
- `missing` — informacja wymagana, której jeszcze nie pozyskano,
- `not_applicable` — pole nie dotyczy tej nieruchomości.

Pochodzenie:

- ręcznie od agenta,
- deklaracja właściciela,
- dokument,
- materiał wizualny,
- publiczne źródło,
- integracja zewnętrzna,
- analiza AI.

### 6.4. Źródła

Źródło może być:

- plikiem,
- zdjęciem,
- filmem,
- notatką tekstową,
- transkrypcją notatki głosowej,
- rekordem z publicznego źródła,
- adresem URL,
- oświadczeniem osoby.

Źródło ma właściciela, datę pozyskania, zakres dostępu, sumę kontrolną pliku i
informację o retencji.

### 6.5. Kontrola jakości

Property Truth Engine pokazuje:

- wymagane informacje bez wartości,
- konflikty między źródłami,
- fakty użyte w materiałach bez wystarczającego potwierdzenia,
- źródła nieaktualizowane od oznaczonego czasu,
- materiały utworzone przed zmianą kluczowego faktu,
- listę pytań do właściciela lub urzędu.

Wskaźnik kompletności nie jest jedną oceną „jakości nieruchomości”. Jest
procentem wypełnienia wymaganych pól dla danego typu procesu i nieruchomości.

## 7. Moduł 2: Plot Future Lab

### Wejście

- działka z Property Truth Engine,
- identyfikator działki lub geometria,
- dostępne dane publiczne,
- cel użytkownika, np. sprzedaż rodzinie, inwestorowi albo deweloperowi.

### Proces

1. Pobranie i zapis kopii danych wraz z datą oraz źródłem.
2. Ocena zasięgu źródeł: dostępne, niedostępne, niejednoznaczne.
3. Wyodrębnienie ograniczeń i faktów planistycznych.
4. Wygenerowanie pytań wymagających potwierdzenia.
5. Utworzenie scenariuszy:
   - bezpieczny — wykorzystuje wyłącznie potwierdzone informacje,
   - optymalny — zawiera jawnie opisane założenia,
   - aspiracyjny — wizualizuje potencjał bez deklaracji wykonalności.
6. Zatwierdzenie scenariusza przez agenta.
7. Wygenerowanie plansz, filmu i raportu.

### Wyjście

- mapa źródeł,
- lista potwierdzonych danych i ograniczeń,
- trzy scenariusze,
- wizualizacje z etykietą,
- film pokazujący rozwój koncepcji,
- raport PDF lub strona dla klienta,
- lista pytań do architekta, urzędu albo właściciela.

### Granice

- brak automatycznej opinii prawnej,
- brak deklaracji pozwolenia na budowę,
- brak zastępowania projektu architektonicznego,
- brak ukrywania braków pokrycia danych,
- każda wizualizacja pokazuje datę, założenia i źródła.

## 8. Moduł 3: Fact-Locked Offer Launch Lab

### Zasada blokady faktów

Generator może stosować różny ton, strukturę i kolejność argumentów, ale nie
może modyfikować wartości ze zbioru zatwierdzonych faktów.

Każda wygenerowana treść przechowuje:

- identyfikatory użytych faktów,
- wersję faktów,
- użyty szablon i model,
- autora generacji,
- datę,
- status zatwierdzenia,
- historię poprawek.

Jeżeli kluczowy fakt zostanie zmieniony, platforma oznacza wcześniejsze
materiały jako wymagające ponownej weryfikacji.

### Typy materiałów

- opis portalowy,
- skrócony opis do social media,
- karuzela,
- scenariusz rolki,
- plansze i napisy,
- film poziomy,
- scenariusz avatara,
- reklama dla wybranego segmentu,
- harmonogram kampanii,
- wiadomości do leadów,
- prezentacja pozyskowa dla właściciela,
- raport działań marketingowych.

### Publikacja

MVP kończy się eksportem lub kopiowaniem. Integracje publikacyjne są osobnym
etapem i wymagają zatwierdzenia zakresu uprawnień.

## 9. Moduł 4: Buyer Room

Buyer Room jest kontrolowanym widokiem jednej oferty dla osoby zainteresowanej.

Funkcje:

- prezentacja zatwierdzonych informacji,
- oryginalne media i jawnie oznaczone wizualizacje,
- pytania tekstowe i głosowe,
- odpowiedzi wyłącznie na podstawie dopuszczonych faktów,
- bezpieczna odpowiedź „nie mamy tej informacji”,
- zbieranie pytań bez odpowiedzi,
- kwalifikacja zainteresowania za zgodą użytkownika,
- prośba o kontakt z agentem,
- podsumowanie rozmowy dla agenta.

Buyer Room nie ujawnia prywatnych dokumentów ani pól oznaczonych jako
wewnętrzne.

## 10. Moduł 5: Deal Risk Radar

Funkcje:

- checklista wymaganych dokumentów zależna od rodzaju procesu,
- wykrywanie braków i sprzeczności,
- przypomnienia o terminach,
- rejestr ustaleń,
- podział na informacje, decyzje i zadania,
- lista spraw wymagających konsultacji z prawnikiem, notariuszem, architektem
  albo urzędem,
- historia osoby, która zamknęła dany punkt.

System nie wydaje opinii prawnych i nie zastępuje specjalisty.

## 11. Academy & Coach

Istniejące funkcje szkoleniowe pozostają w produkcie. Zmienia się ich rola:

- Classroom i materiały stają się zapleczem wiedzy,
- obecni agenci AI mogą działać jako pomoc kontekstowa,
- trening rozmowy korzysta z prawdziwej teczki nieruchomości,
- ćwiczenia mogą być przypisane do braków wykrytych w pracy agenta,
- społeczność pozostaje miejscem wymiany praktyk i szablonów.

Nie usuwamy istniejących funkcji w pierwszej fazie. Nowy rdzeń jest dodawany
obok nich, a decyzja o zmianie nawigacji i wygaszeniu starych ekranów wymaga
osobnej akceptacji.

## 12. Informacja i nawigacja

Docelowa nawigacja pierwszego poziomu:

- Studio,
- Nieruchomości,
- Akademia,
- Społeczność,
- Profil.

W teczce nieruchomości:

- Przegląd,
- Fakty,
- Źródła,
- Braki i konflikty,
- Future Lab,
- Materiały,
- Buyer Room,
- Proces,
- Historia.

Przed implementacją nowych ekranów trzeba przedstawić Darkowi trzy kierunki UI
obejmujące paletę, typografię, layout i mood. Obecny styl „Czarna porcelana”
jest punktem wyjścia, a nie automatycznie ostateczną decyzją.

## 13. Model danych

### Organization

- `id`
- `name`
- `slug`
- `createdAt`
- `updatedAt`

### Membership

- `organizationId`
- `userId` z Cognito
- `role`: owner, admin, agent, marketer, viewer
- `createdAt`

### PropertyProject

- `id`
- `organizationId`
- `createdByUserId`
- `title`
- `propertyType`
- `transactionType`
- `stage`
- `city`
- `district`
- `addressMode`: exact, approximate, hidden
- `address`
- `plotIdentifier`
- `coverAssetId`
- `createdAt`
- `updatedAt`
- `archivedAt`

### PropertyFact

- `id`
- `propertyProjectId`
- `key`
- `label`
- `category`
- `valueType`
- `value`
- `unit`
- `status`
- `visibility`: internal, client, public
- `createdByType`: user, ai, integration
- `createdById`
- `confirmedByUserId`
- `confirmedAt`
- `version`
- `createdAt`
- `updatedAt`

### Source

- `id`
- `propertyProjectId`
- `type`
- `title`
- `storageKey` albo `sourceUrl`
- `mimeType`
- `checksum`
- `capturedAt`
- `accessLevel`
- `retentionPolicy`
- `createdByUserId`
- `createdAt`

### FactEvidence

- `factId`
- `sourceId`
- `relation`: supports, contradicts, mentions
- `excerpt`
- `pageOrTimestamp`
- `createdByType`
- `createdAt`

### GeneratedAsset

- `id`
- `propertyProjectId`
- `type`
- `status`
- `storageKey`
- `promptManifest`
- `factVersionManifest`
- `aiDisclosure`
- `approvedByUserId`
- `approvedAt`
- `createdAt`

### GenerationJob

- `id`
- `propertyProjectId`
- `provider`
- `operation`
- `status`
- `inputManifest`
- `outputAssetId`
- `estimatedCost`
- `finalCost`
- `errorCode`
- `createdAt`
- `completedAt`

### AuditEvent

- `id`
- `organizationId`
- `propertyProjectId`
- `actorType`
- `actorId`
- `action`
- `entityType`
- `entityId`
- `before`
- `after`
- `createdAt`

### BuyerRoomSession

- `id`
- `propertyProjectId`
- `publicTokenHash`
- `consentState`
- `leadId`
- `startedAt`
- `endedAt`
- `handoffRequestedAt`

## 14. Architektura techniczna

### Warstwa istniejąca do zachowania

- Next.js 14 App Router i React 18,
- obecna autentykacja Cognito oraz sesja serwerowa,
- Anthropic jako jeden z dostawców LLM,
- Vercel KV dla cache, limitów i krótkotrwałego stanu,
- Pinecone dla istniejącej publicznej bazy prawnej,
- Stripe dla istniejących planów,
- obecny design system do czasu wyboru kierunku UI.

### Nowe elementy

- PostgreSQL jako źródło prawdy dla nieruchomości, faktów, źródeł i audytu,
- obiektowy storage dla dokumentów, obrazów, filmów i wyników generacji,
- kolejka zadań dla analizy dokumentów i generowania mediów,
- provider adapters dla LLM, wideo, głosu, avatara i danych przestrzennych,
- osobna warstwa polityk publikacji i widoczności,
- telemetryka kosztu i wyniku każdej generacji.

### Podział odpowiedzialności

- PostgreSQL przechowuje dane strukturalne i relacje.
- Object storage przechowuje pliki.
- KV nie jest podstawową bazą nieruchomości.
- Pinecone nie jest źródłem prawdy dla faktów o nieruchomości.
- LLM proponuje strukturę i treść, ale nie zmienia samodzielnie potwierdzonych
  faktów.
- Każde połączenie z dostawcą zewnętrznym przechodzi przez adapter, dzięki czemu
  można zmienić model lub usługę bez przebudowy modułu biznesowego.

## 15. Integracje

### MVP fundamentu

- Cognito,
- PostgreSQL,
- obecny Anthropic,
- obecny Vercel KV.

### Plot Future Lab

- Geoportal WMS/WMTS,
- Rejestr Urbanistyczny,
- dostępne dane RCN,
- Poznań Open Data,
- dostawca map lub własne renderowanie warstw,
- dostawca generowania obrazu i wideo.

Każde źródło ma adapter, datę pobrania, informację o licencji, atrybucję i
status zasięgu.

### Offer Launch Lab

- dostawca LLM,
- dostawca obrazu i wideo,
- opcjonalnie dostawca avatara,
- opcjonalnie dostawca głosu,
- eksport plików i pakietów.

### Integracje późniejsze

- Keller Williams Command, jeśli uzyskamy oficjalny i wystarczający dostęp,
- portale ogłoszeniowe,
- Meta Ads,
- kalendarz,
- CRM i automatyzacje follow-up.

Integracje publikujące lub zmieniające dane zewnętrzne nie należą do pierwszego
MVP.

## 16. Bezpieczeństwo, prywatność i zaufanie

### Multi-tenancy

- każdy rekord należy do organizacji,
- użytkownik uzyskuje dostęp przez Membership,
- `organizationId` nie jest przyjmowane bezpośrednio jako źródło uprawnienia,
- serwer ustala użytkownika na podstawie podpisanej sesji,
- zapytania danych zawsze zawierają warunek organizacji i uprawnienia.

### Dokumenty i dane klientów

- domyślnie prywatne,
- pliki udostępniane przez krótkotrwałe podpisane adresy,
- brak indeksowania prywatnych źródeł w publicznym indeksie,
- logi nie zawierają treści dokumentów ani rozmów,
- usunięcie konta lub organizacji obejmuje dane SQL, obiekty i indeksy.

### AI

- jawne oznaczenie treści wygenerowanej lub zmienionej przez AI,
- przechowywanie oryginału,
- manifest modelu, źródeł i wersji faktów,
- zakaz automatycznego potwierdzania własnego wniosku,
- zakaz wysyłania całych dokumentów do dostawcy, jeśli wystarczy wybrany
  fragment,
- konfiguracja retencji i zgód zależna od dostawcy.

### Publikacja

- status `draft`, `needs_review`, `approved`, `superseded`,
- tylko człowiek może nadać `approved`,
- zmiana faktu użytego w zatwierdzonym materiale nadaje mu
  `needs_review`.

## 17. Zakres MVP

### MVP 1 — Property Truth Engine

- lista i tworzenie nieruchomości,
- etapy procesu,
- paszport faktów,
- statusy i źródła faktów,
- braki i konflikty,
- ręczne zatwierdzanie,
- historia zmian,
- izolacja danych użytkownika,
- eksport i usunięcie danych zgodne z RODO.

### MVP 2 — Źródła i analiza

- upload dokumentów i mediów,
- transkrypcja notatek głosowych,
- propozycje faktów z dokumentów,
- wiązanie faktów z fragmentami źródeł,
- kolejka weryfikacji,
- kontrola kosztu i błędów.

### MVP 3 — pierwszy efekt WOW

- Plot Future Lab ograniczony do działek z dostępem do danych dla Poznania,
- mapa źródeł i zasięgu,
- trzy scenariusze,
- wizualizacje koncepcyjne,
- jeden format krótkiego filmu,
- raport klienta.

### MVP 4 — Offer Launch Lab

- generator opisów i rolek z blokadą faktów,
- wersje dla wybranych person,
- manifest wykorzystanych faktów,
- ręczna akceptacja i eksport.

### Po potwierdzeniu użycia

- Buyer Room,
- Deal Risk Radar,
- trening głosowy,
- integracje publikacyjne i CRM,
- analityka organizacji.

## 18. Poza zakresem pierwszego wdrożenia

- własny model generowania obrazu lub wideo,
- automatyczna publikacja reklam i ogłoszeń,
- automatyczne decyzje prawne lub kredytowe,
- deklarowanie możliwości zabudowy bez potwierdzenia,
- ogólnopolska normalizacja wszystkich danych przestrzennych od pierwszego dnia,
- zastąpienie CRM Keller Williams,
- przebudowa wszystkich istniejących ekranów,
- zmiana cen i pakietów.

## 19. Mierniki produktu

### Aktywacja

- utworzenie pierwszej nieruchomości,
- dodanie pierwszego źródła,
- uzupełnienie pierwszego paszportu,
- rozwiązanie pierwszego konfliktu.

### Wartość operacyjna

- czas od utworzenia teczki do stanu `ready`,
- udział faktów powiązanych ze źródłem,
- liczba braków wykrytych przed publikacją,
- liczba materiałów wymagających ponownej weryfikacji po zmianie faktu,
- liczba nieruchomości aktualizowanych w kolejnym tygodniu.

### Wartość dla klienta

- liczba otwarć Buyer Room,
- pytania, na które teczka nie zna odpowiedzi,
- liczba próśb o kontakt,
- czas odpowiedzi agenta po przekazaniu leada.

### Ekonomia

- koszt analizy jednej nieruchomości,
- koszt wygenerowania zatwierdzonego materiału,
- udział generacji odrzuconych,
- wykorzystanie modułów według planu.

Nie ustalamy progów sukcesu bez danych z pilotażu.

## 20. Kryteria gotowości Property Truth Engine

Fundament jest gotowy do pilotażu, gdy:

1. Dwóch użytkowników nie może odczytać ani zmienić wzajemnych nieruchomości.
2. Agent może utworzyć, edytować i zarchiwizować nieruchomość.
3. Każdy fakt ma status i pochodzenie.
4. Fakt `confirmed` ma zapisane źródło albo potwierdzającego użytkownika.
5. Konflikt pozostaje widoczny do czasu świadomego rozwiązania.
6. Historia pokazuje, kto i kiedy zmienił wartość lub status.
7. Eksport konta obejmuje dane Property Intelligence Studio.
8. Usunięcie konta usuwa dane strukturalne i powiązane pliki.
9. Logi nie zawierają treści faktów ani dokumentów.
10. Build, testy domenowe i test uprawnień przechodzą bez błędów.

## 21. Decyzje przed kodowaniem UI

Przed implementacją nowych ekranów wymagane są:

1. wybór jednego z trzech kierunków wizualnych,
2. zatwierdzenie nazwy widocznej dla użytkownika,
3. decyzja, czy pilotaż jest osobnym modułem Akademii AI, czy nowym głównym
   ekranem startowym,
4. wskazanie grupy pilotażowej i przykładowych nieruchomości,
5. potwierdzenie, czy pierwszym przypadkiem WOW jest działka, mieszkanie czy oba.

## 22. Kolejność decyzji technicznych

1. Zatwierdzić model organizacji i użytkowników.
2. Wybrać zarządzany PostgreSQL i storage.
3. Zbudować Property Truth Engine bez generowania mediów.
4. Zebrać przykładowe teczki i sprawdzić model faktów.
5. Dopiero wtedy podłączyć ekstrakcję AI.
6. Uruchomić Plot Future Lab dla ograniczonego obszaru.
7. Zmierzyć jakość danych, koszty i reakcję agentów.
8. Rozszerzać kolejne moduły na podstawie wykorzystania.

