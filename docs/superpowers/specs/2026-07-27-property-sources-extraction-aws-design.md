# Property Intelligence Studio — źródła i ekstrakcja na AWS

Data: 2026-07-27

Status: zatwierdzony projekt M2

Właściciel biznesowy: Wojtek Lisiecki, Keller Williams, Poznań

Właściciel produktu: Darek

Właściciel techniczny: CTO

## 1. Decyzja

M2 zmienia ręczny paszport nieruchomości w kontrolowany przepływ:

> źródło → dowód → propozycja → decyzja człowieka → fakt

Pliki i procesy ekstrakcji działają w AWS. Interfejs, sesje użytkowników,
teczki, fakty i historia pozostają w istniejącej aplikacji Next.js oraz
PostgreSQL.

Nie używamy Vercel Blob. Przeglądarka wysyła plik bezpośrednio do prywatnego
Amazon S3, dzięki czemu plik nie przechodzi przez funkcję Vercela i jej limity
transferu.

## 2. Cel etapu

Po wdrożeniu agent może:

1. dodać dokument, zdjęcie, arkusz albo krótką notatkę głosową do teczki,
2. śledzić stan przetwarzania,
3. zobaczyć propozycje faktów wraz z dowodem,
4. zaakceptować, poprawić albo odrzucić każdą propozycję,
5. porównać dwie sprzeczne wartości bez automatycznego nadpisania,
6. ponowić przerwane zadanie bez ponownego wysyłania pliku,
7. usunąć źródło wraz z jego plikami i danymi pochodnymi.

M2 nie publikuje ofert i nie uruchamia jeszcze Plot Future Lab, Offer Launch
Lab ani Buyer Room. Buduje wiarygodne wejście danych dla tych modułów.

## 3. Zasady niepodlegające negocjacji

- AI nie może ustawić statusu faktu na `confirmed`.
- Każda propozycja musi wskazywać istniejące źródło i dowód.
- Treść dokumentu jest danymi niezaufanymi, a nie instrukcją dla modelu.
- Brak dowodu kończy się brakiem propozycji, a nie domysłem.
- Inny użytkownik lub organizacja nie może odczytać źródła, zadania ani
  propozycji.
- Oryginał pliku jest niezmienny. Ponowne wysłanie tworzy nowe źródło albo
  zostaje rozpoznane jako duplikat.
- Wszystkie operacje akceptacji, korekty, odrzucenia i rozwiązania konfliktu
  mają wpis audytowy.

## 4. Architektura

```text
Przeglądarka
    │
    │ 1. żądanie utworzenia źródła
    ▼
Next.js / Property Service ───────────────► PostgreSQL
    │                                         │
    │ 2. krótko ważny upload                  │ źródła, zadania,
    │    z poświadczeniami OIDC               │ propozycje, audyt
    ▼                                         │
Prywatny Amazon S3                            │
    │                                         │
    │ 3. GuardDuty Malware Protection         │
    ▼                                         │
Amazon EventBridge                            │
    │                                         │
    ▼                                         │
AWS Step Functions                            │
    ├── walidacja pliku                       │
    ├── podział dokumentu                     │
    ├── Amazon Transcribe dla audio           │
    ├── Bedrock: mapa dowodów                 │
    ├── Bedrock: propozycje strukturalne      │
    └── podpisany callback ───────────────────┘
```

### 4.1. Podział odpowiedzialności

Next.js odpowiada za:

- sesję i autoryzację użytkownika,
- sprawdzenie dostępu do nieruchomości,
- utworzenie rekordu źródła,
- wygenerowanie ograniczonego uploadu,
- odczyt źródeł i propozycji,
- przyjęcie podpisanego wyniku z AWS,
- wykrycie konfliktu z aktualnym paszportem,
- decyzje człowieka i audyt.

AWS odpowiada za:

- prywatne przechowywanie oryginału,
- kontrolę integralności pliku,
- skan malware przed udostępnieniem pliku workerowi,
- trwałe uruchomienie i ponawianie procesu,
- przygotowanie dokumentu do analizy,
- transkrypcję audio,
- analizę dokumentu przez Amazon Bedrock,
- zapis metryk wykonania,
- usuwanie danych roboczych i plików.

## 5. Dostęp aplikacji do AWS

Funkcje Vercela korzystają z federacji OIDC i wywołania
`AssumeRoleWithWebIdentity`. Nie przechowujemy długoterminowego
`AWS_ACCESS_KEY_ID` ani `AWS_SECRET_ACCESS_KEY` w Vercelu.

Rola Vercela:

- ufa wyłącznie wskazanemu zespołowi, projektowi i środowisku Vercel,
- może utworzyć ograniczony upload do konkretnego prefiksu S3,
- może odczytać metadane konkretnego obiektu,
- może utworzyć krótko ważny link odczytu po ponownym sprawdzeniu sesji,
- nie może listować całego bucketa,
- nie może wywoływać Bedrock, Transcribe ani Step Functions.

Zmiana nazwy projektu Vercel zmienia deklarację `sub` w tokenie OIDC. Przy
technicznej zmianie nazwy produktu polityka zaufania przez krótki okres
obsługuje starą i nową nazwę, a po potwierdzeniu produkcji stara deklaracja
zostaje usunięta.

## 6. Magazyn S3

Powstaje oddzielny bucket dla każdego środowiska:

- `dev` używa wyłącznie danych syntetycznych,
- `prod` używa danych użytkowników.

Wymagane ustawienia:

- region `eu-central-1`,
- Block Public Access włączony dla wszystkich czterech opcji,
- szyfrowanie SSE-KMS,
- wersjonowanie włączone,
- TLS wymagany przez bucket policy,
- brak publicznych ACL i publicznych polityk,
- logowanie wyłącznie metadanych operacji, bez treści dokumentów,
- tagi `Project`, `Env`, `Owner` i `CostCenter`.

Prefiks `originals/` jest chroniony przez GuardDuty Malware Protection for S3.
Po skanowaniu obiekt otrzymuje kontrolowany tag. Polityka dostępu pozwala
workerowi czytać wyłącznie obiekt z wynikiem `NO_THREATS_FOUND`. Wynik
`THREATS_FOUND` blokuje podgląd, pobieranie i analizę. Wyniki `FAILED`,
`UNSUPPORTED` oraz `ACCESS_DENIED` nie są traktowane jako wynik bezpieczny.

Klucz obiektu nie zawiera nazwy pliku, adresu ani danych osobowych:

```text
originals/{sourceId}/original
work/{sourceId}/{jobId}/{chunkId}
transcripts/{sourceId}/{jobId}/transcript.json
```

Oryginalna nazwa jest przechowywana jako bezpieczna nazwa wyświetlana w bazie.
Nie jest przekazywana modelowi jako instrukcja. Model otrzymuje neutralną nazwę
`Property source {sourceId}`.

## 7. Upload

### 7.1. Inicjacja

Użytkownik wybiera plik. Przeglądarka oblicza SHA-256 i wysyła do API:

- nazwę,
- deklarowany MIME,
- rozmiar,
- SHA-256,
- rodzaj materiału.

API:

1. sprawdza sesję,
2. pobiera nieruchomość w ramach organizacji użytkownika,
3. waliduje format i limit,
4. tworzy `property_source` ze stanem `upload_pending`,
5. generuje krótko ważne dane uploadu do dokładnego klucza S3.

Upload wiąże:

- dokładny klucz obiektu,
- deklarowany Content-Type,
- SHA-256,
- maksymalny rozmiar,
- szyfrowanie KMS.

### 7.2. Zakończenie uploadu

Po zapisaniu obiektu GuardDuty automatycznie uruchamia skan i publikuje wynik do
EventBridge. Dopiero wynik `NO_THREATS_FOUND` uruchamia analizę. Proces nie
zależy od tego, czy użytkownik pozostawi otwartą kartę.

Pierwszy krok workflow:

- wykonuje `HeadObject`,
- porównuje rozmiar i checksum z rekordem,
- sprawdza sygnaturę pliku, a nie tylko rozszerzenie,
- potwierdza bezpieczny wynik skanu GuardDuty,
- odrzuca pliki aktywne, zaszyfrowane albo uszkodzone,
- przełącza źródło na `validating`, a następnie `processing`.

Brak rekordu źródła, niezgodność sumy albo nieprawidłowy typ kończą się
odrzuceniem obiektu i kontrolowanym błędem.

## 8. Obsługiwane formaty i limity

### 8.1. Dokumenty i obrazy

- PDF,
- JPG i JPEG,
- PNG,
- WebP,
- DOCX,
- XLSX,
- TXT w UTF-8,
- CSV w UTF-8.

Limit produktu:

- 25 MB na dokument,
- 100 stron PDF,
- 3,75 MB na pojedynczy obraz wejściowy do modelu,
- pięć równoległych uploadów na nieruchomość.

Odrzucamy:

- DOCM i XLSM,
- stare binarne DOC i XLS,
- archiwa ZIP i RAR,
- pliki wykonywalne i skrypty,
- zaszyfrowane lub chronione hasłem PDF-y,
- pliki, których sygnatura nie zgadza się z dozwolonym formatem.

### 8.2. Notatki głosowe

- MP3,
- M4A,
- WAV,
- WebM,
- maksymalnie 10 minut.

Amazon Transcribe działa w trybie batch z językiem `pl-PL`. Wynik zawiera tekst
oraz znaczniki czasu. Transkrypcja staje się źródłem pochodnym i przechodzi przez
ten sam proces tworzenia propozycji.

Stan implementacji 27 lipca 2026: AWS wymaga `Resource: "*"` dla
`StartTranscriptionJob`, a polityka COSTSEC zabrania takiego grantu. Dlatego
audio jest przyjmowane i walidowane, ale automatycznie trafia do ręcznej
weryfikacji. Transcribe `pl-PL` pozostaje projektem docelowym po jawnym
zatwierdzeniu wyjątku albo zmianie dostawcy na usługę z dostępem ograniczanym
do dokładnego zasobu.

## 9. Przygotowanie dokumentów

Amazon Bedrock Converse przyjmuje dokumenty do 4,5 MB na blok. Dlatego plik
produktu może być większy, ale worker przygotowuje mniejsze części.

### 9.1. PDF

- plik jest dzielony na części do 4,2 MB,
- część zachowuje kolejność i przesunięcie numerów stron,
- maksymalnie 20 stron jest analizowanych w jednym kroku,
- wynik cytowania lokalnej strony jest przeliczany na stronę oryginału.

### 9.2. DOCX

- worker odczytuje akapity i tabele bez wykonywania osadzonych elementów,
- treść jest dzielona na ponumerowane bloki,
- locator wskazuje numer bloku i fragment tekstu.

### 9.3. XLSX i CSV

- worker odczytuje wartości komórek, nie wykonuje formuł ani makr,
- locator wskazuje arkusz, wiersz i komórkę,
- puste lub ukryte arkusze nie tworzą automatycznie faktów.

### 9.4. Obrazy

- worker sprawdza wymiary i format,
- obraz jest analizowany jako materiał wizualny,
- locator wskazuje stronę `1` i rozpoznany fragment,
- brak czytelnego tekstu kończy się stanem `no_readable_content`.

## 10. Analiza AI

Pierwszym dostawcą jest Amazon Bedrock Converse. Podstawowym modelem jest Claude
Haiku 4.5. Claude Sonnet 4.6 jest używany tylko po nieudanej walidacji wyniku
albo dla złożonego konfliktu. Dokładne identyfikatory profili inferencji są
wybierane z listy dostępnej na koncie i przechowywane w konfiguracji, nie w
kodzie.

### 10.1. Przebieg pierwszy: mapa dowodów

Model otrzymuje:

- neutralną nazwę źródła,
- typ nieruchomości i transakcji,
- dozwolony katalog pól,
- dokument lub fragment,
- instrukcję traktowania zawartości jako `UNTRUSTED DATA`.

Model ma zwrócić wyłącznie jawne informacje wraz z cytowaniem. System zapisuje:

- dokładny cytowany fragment,
- stronę, blok, komórkę albo czas,
- typ potencjalnej wartości,
- identyfikator dowodu.

Polecenia znalezione w dokumencie, np. „zignoruj wcześniejsze instrukcje”,
pozostają treścią źródła i nie zmieniają procesu.

### 10.2. Przebieg drugi: propozycje

Drugi przebieg nie otrzymuje całego oryginału. Otrzymuje wyłącznie:

- katalog dozwolonych pól,
- ponumerowane dowody z pierwszego przebiegu,
- schemat wyniku.

Zwraca ustrukturyzowane propozycje. Każda propozycja musi wskazać istniejący
`evidenceId`. Zod odrzuca:

- nieznany klucz faktu,
- wartość niezgodną z typem,
- brak dowodu,
- locator spoza dokumentu,
- próbę ustawienia `confirmed`,
- dodatkowe, niedozwolone pola.

Jeżeli walidacja nie powiedzie się dwa razy, zadanie kończy się stanem
`needs_manual_review`. Model nie dostaje kolejnych nieograniczonych prób.

## 11. Trwałe przetwarzanie i idempotencja

AWS Step Functions Standard prowadzi każdy proces. Idempotency key:

```text
sha256(sourceId + sourceChecksum + pipelineVersion)
```

Ponowne zdarzenie S3:

- nie tworzy drugiego aktywnego zadania,
- może dołączyć do istniejącego wyniku,
- nie nalicza drugi raz zaakceptowanych propozycji.

Workflow ma ograniczoną liczbę prób z wykładniczym opóźnieniem. Trwałe błędy są
oznaczone jako `failed` podpisanym callbackiem z kodem
`EXTRACTION_FAILED`, a błąd uruchomienia trafia do DLQ. Użytkownik może wybrać
„Ponów analizę”; powstaje nowy job z tą samą wersją źródła i kolejnym numerem
próby.

## 12. Callback z AWS do Studio

AWS nie otrzymuje bezpośredniego hasła do PostgreSQL.

Worker wywołuje dwa wewnętrzne endpointy:

- pobranie minimalnego kontekstu źródła,
- zapis zakończonego wyniku.

Żądanie zawiera:

- timestamp,
- nonce,
- hash body,
- podpis HMAC.

Sekret podpisu jest przechowywany w AWS Secrets Manager i jako chroniona
zmienna środowiskowa Vercel. Endpoint odrzuca:

- podpis niezgodny,
- timestamp starszy niż pięć minut,
- użyty wcześniej nonce,
- źródło z innej organizacji,
- niezgodny checksum lub job,
- próbę zapisania faktu jako `confirmed`.

Callback zapisuje tylko źródło, status zadania, metryki i propozycje. Decyzja
agenta przechodzi przez zwykły `PropertyService`.

## 13. Model danych

### 13.1. `property_sources`

- `id`,
- `organization_id`,
- `property_project_id`,
- `created_by_user_id`,
- `kind`,
- `original_filename`,
- `display_name`,
- `mime_type`,
- `size_bytes`,
- `checksum_sha256`,
- `storage_key`,
- `status`,
- `visibility`,
- `error_code`,
- `error_message`,
- `uploaded_at`,
- `processed_at`,
- `created_at`,
- `updated_at`,
- `deleted_at`.

Statusy:

- `upload_pending`,
- `uploaded`,
- `scanning`,
- `validating`,
- `processing`,
- `review_ready`,
- `completed`,
- `failed`,
- `deleted`.

### 13.2. `source_processing_jobs`

- `id`,
- `source_id`,
- `idempotency_key`,
- `pipeline_version`,
- `provider`,
- `model`,
- `status`,
- `attempt_count`,
- `input_units`,
- `output_units`,
- `provider_cost_microunits`,
- `currency`,
- `started_at`,
- `finished_at`,
- `error_code`,
- `created_at`,
- `updated_at`.

Statusy:

- `queued`,
- `running`,
- `waiting_external`,
- `succeeded`,
- `failed`,
- `needs_manual_review`.

`idempotency_key` jest unikalny.

### 13.3. `property_fact_proposals`

- `id`,
- `organization_id`,
- `property_project_id`,
- `source_id`,
- `job_id`,
- `fact_key`,
- `suggested_label`,
- `suggested_category`,
- `value_type`,
- `suggested_value`,
- `unit`,
- `evidence_text`,
- `evidence_locator`,
- `confidence`,
- `status`,
- `conflicts_with_fact_id`,
- `decision_note`,
- `decided_by_user_id`,
- `decided_at`,
- `accepted_fact_id`,
- `created_at`,
- `updated_at`.

Statusy:

- `pending`,
- `accepted`,
- `corrected`,
- `rejected`,
- `conflict`,
- `needs_manual_review`.

Unikalność propozycji obejmuje `job_id`, `fact_key` i `evidence_locator`.

### 13.4. `extraction_callback_nonces`

- `nonce_hash`,
- `job_id`,
- `action`,
- `expires_at`,
- `created_at`.

`nonce_hash` jest kluczem głównym. Rekord powstaje atomowo przed obsługą
callbacku, więc drugi request z tym samym nonce jest odrzucany. Wygasłe rekordy
są usuwane cyklicznie po 24 godzinach.

## 14. Decyzje człowieka

### 14.1. Akceptacja bez konfliktu

Użytkownik widzi wartość i dowód. Po akceptacji:

- nowy fakt powstaje jako `confirmed`,
- źródło trafia do `sourceIds`,
- `confirmedByUserId` wskazuje użytkownika,
- propozycja otrzymuje `accepted`,
- powstaje wpis audytowy.

Jeżeli fakt już istnieje z tą samą wartością, system dodaje źródło i zwiększa
wersję tylko wtedy, gdy relacja źródła faktycznie się zmieniła.

### 14.2. Korekta

Użytkownik może zmienić wartość przed akceptacją. System zachowuje:

- oryginalną sugestię,
- poprawioną wartość,
- dowód,
- osobę i czas korekty.

Status propozycji to `corrected`, a fakt jest potwierdzony przez człowieka i
powiązany ze źródłem.

### 14.3. Konflikt

Jeżeli nowa wartość różni się od aktywnego faktu o tym samym kluczu:

- propozycja otrzymuje `conflict`,
- obecny fakt nie jest nadpisywany,
- ekran pokazuje obie wartości i oba źródła.

Agent wybiera:

1. zachowaj obecną wartość,
2. przyjmij nową wartość,
3. pozostaw konflikt otwarty.

Przy otwartym konflikcie fakt otrzymuje status `conflicting`, a alternatywna
wartość pozostaje w propozycji. Rozwiązanie konfliktu jest wersjonowane i
audytowane.

### 14.4. Akcje zbiorcze

Użytkownik może zaznaczyć wiele propozycji i jawnie wybrać „Zatwierdź
zaznaczone”. Akcja zbiorcza nie obejmuje:

- konfliktów,
- propozycji bez pełnego locatora,
- propozycji wymagających ręcznej korekty.

Nie ma automatycznego zatwierdzania według progu confidence.

## 15. Interfejs

Teczka otrzymuje nawigację:

- Paszport,
- Źródła,
- Do weryfikacji,
- Konflikty,
- Historia.

Docelowe adresy:

```text
/nieruchomosci/{propertyId}
/nieruchomosci/{propertyId}/zrodla
/nieruchomosci/{propertyId}/weryfikacja
/nieruchomosci/{propertyId}/konflikty
/nieruchomosci/{propertyId}/historia
```

### 15.1. Stół weryfikacyjny

Na komputerze:

- lewa kolumna: źródła i ich statusy,
- środkowa kolumna: podgląd dokumentu albo transkrypcji,
- prawa kolumna: propozycje i decyzje.

Na telefonie:

- źródło wybiera się z listy,
- podgląd i propozycje są kolejnymi sekcjami,
- bieżące akcje pozostają w dolnym pasku,
- żadna akcja nie wymaga poziomego przewijania.

Zachowujemy istniejącą paletę, typografię, promienie, obramowania oraz spokojny
redakcyjny charakter Studio.

### 15.2. Statusy użytkowe

```text
Wysyłanie
Sprawdzanie pliku
Analiza źródła
Do weryfikacji
Zakończono
Wymaga działania
Nie udało się
```

Każdy status ma tekst, nie tylko kolor lub ikonę.

## 16. Podgląd i pobieranie

Bucket nie ma publicznych adresów.

Podgląd:

- ponownie sprawdza sesję i dostęp do nieruchomości,
- tworzy krótko ważny link GET albo strumieniuje bezpieczny typ,
- ustawia bezpieczny Content-Type i Content-Disposition,
- nie renderuje DOCX ani XLSX jako aktywnego HTML,
- otwiera PDF w izolowanym podglądzie,
- pozwala pobrać oryginał.

Źródło usunięte lub należące do innego użytkownika zwraca bezpieczne `404`, nie
ujawniając jego istnienia.

## 17. Obsługa błędów

Kody błędów produktu:

- `unsupported_format`,
- `file_too_large`,
- `page_limit_exceeded`,
- `checksum_mismatch`,
- `mime_mismatch`,
- `malware_detected`,
- `malware_scan_failed`,
- `encrypted_document`,
- `malformed_document`,
- `no_readable_content`,
- `transcription_failed`,
- `provider_unavailable`,
- `provider_rate_limited`,
- `invalid_model_output`,
- `source_deleted`,
- `processing_timeout`.

Użytkownik widzi:

- co się stało,
- czy oryginał został zapisany,
- czy może ponowić analizę,
- czy musi przesłać inny plik.

Treść błędu dostawcy nie jest pokazywana użytkownikowi ani zapisywana z treścią
dokumentu w logu.

## 18. Retencja i usuwanie

- niedokończony upload jest usuwany po 24 godzinach,
- `work/` i dane techniczne są usuwane po 7 dniach,
- transkrypcje techniczne w S3 są usuwane po 7 dniach,
- oryginał pozostaje do usunięcia źródła, nieruchomości albo konta,
- zwykłe nieaktualne wersje S3 wygasają po 90 dniach,
- świadome usunięcie uruchamia purge wszystkich wersji wskazanego klucza,
- po rozpoczęciu usunięcia użytkownik natychmiast traci dostęp,
- powiązane propozycje i cytowane fragmenty są usuwane albo anonimizowane
  zgodnie z relacją do zaakceptowanego faktu,
- eksport konta zawiera metadane źródeł, propozycje, decyzje i audyt.

Akceptowany fakt zachowuje informację, że pochodził z usuniętego źródła, ale nie
zachowuje treści usuniętego dowodu. Jeżeli użytkownik świadomie zaakceptował
propozycję, fakt pozostaje `confirmed` i pokazuje komunikat „źródło usunięte,
potwierdzenie agenta zachowane”. Fakt bez potwierdzenia człowieka i bez innego
aktywnego źródła zmienia status na `declared`.

## 19. Obserwowalność

Każde zadanie zapisuje:

- dostawcę i model,
- wersję pipeline,
- liczbę prób,
- czas każdego kroku,
- jednostki wejścia i wyjścia,
- koszt dostawcy,
- kod błędu,
- ostateczny status.

CloudWatch:

- logi mają retencję 14 dni w produkcji i 3 dni w dev,
- logi zawierają identyfikatory techniczne, nie PII ani treść dokumentu,
- alarm obejmuje błędy workflow, wzrost DLQ i serię błędów modelu,
- dashboard pokazuje liczbę zadań, opóźnienie, błędy i koszt.

Kanał wysyłki alarmów jest podłączany dopiero po wskazaniu zatwierdzonego
odbiorcy. Sam alarm i dashboard są częścią infrastruktury.

## 20. Infrastruktura jako kod

AWS jest definiowane w TypeScript przez AWS CDK w tym samym repozytorium.

Stosy `dev` i `prod` mają oddzielne:

- buckety,
- klucze KMS,
- EventBridge rules,
- GuardDuty Malware Protection plans,
- Step Functions,
- Lambdy,
- role IAM,
- DLQ,
- log groups,
- alarmy i dashboardy.

Role są dzielone według odpowiedzialności:

- Vercel upload/download signer,
- GuardDuty scan access,
- walidacja i przygotowanie pliku,
- Bedrock extraction,
- Transcribe,
- callback,
- Step Functions.

Każda rola otrzymuje dostęp tylko do konkretnych ARN-ów. Nie używamy
`Action: "*"`, `Resource: "*"` ani `AdministratorAccess`.

Przed utworzeniem zasobów `prod` powstaje aktualny kosztorys AWS dla ruchu
pilotażowego. Włączenie GuardDuty, Bedrock, Transcribe i Step Functions w
produkcji następuje dopiero po zatwierdzeniu kosztorysu oraz planu zmian.

## 21. Dane demonstracyjne

Powstaje idempotentny seed pięciu teczek:

- dwa mieszkania,
- jeden dom,
- dwie działki.

Każda nazwa zaczyna się od `DEMO —`, a interfejs pokazuje etykietę „Dane
syntetyczne”.

Zestaw zawiera:

- minimum 20 plików,
- minimum 60 faktów referencyjnych,
- minimum 6 kontrolowanych konfliktów,
- dokumenty dobrej i słabej jakości,
- PDF tekstowy i skan,
- zdjęcie dokumentu,
- DOCX,
- XLSX lub CSV,
- polską notatkę głosową,
- plik uszkodzony,
- plik o fałszywym rozszerzeniu,
- zaszyfrowany PDF,
- dokument z próbą prompt injection,
- ten sam plik wysłany ponownie.

Seed może działać wyłącznie dla jawnie wskazanego użytkownika i środowiska.
Nie pobiera ani nie kopiuje danych produkcyjnych.

## 22. Testowanie

### 22.1. Testy jednostkowe

- walidacja formatów i limitów,
- stan źródła i zadania,
- walidacja callbacku HMAC,
- blokada replay,
- mapowanie cytowania na oryginalną stronę,
- walidacja propozycji,
- wykrycie konfliktu,
- decyzje człowieka,
- idempotencja,
- zmiana statusu faktu po usunięciu jedynego źródła.

### 22.2. Testy repozytorium i API

- tenant isolation dla źródeł, zadań i propozycji,
- nieistniejący albo cudzy rekord zwraca `404`,
- upload powstaje tylko dla własnej nieruchomości,
- callback nie może utworzyć potwierdzonego faktu,
- eksport obejmuje dane M2,
- usunięcie konta obejmuje dane M2,
- zdublowany callback nie duplikuje propozycji.

### 22.3. Testy infrastruktury

AWS CDK Assertions sprawdza:

- Block Public Access,
- KMS,
- versioning,
- lifecycle,
- GuardDuty Malware Protection i tag-based access control,
- brak wildcardów IAM,
- log retention,
- DLQ,
- retry workflow,
- ograniczenie OIDC do właściwego projektu i środowiska,
- oddzielenie `dev` od `prod`.

### 22.4. Testy bezpieczeństwa

- dokument z prompt injection nie zmienia schematu ani statusu faktu,
- nazwa pliku nie steruje modelem,
- MIME spoofing zostaje odrzucony,
- obiekt z wynikiem `THREATS_FOUND` nie może zostać pobrany ani przetworzony,
- błąd albo brak wyniku GuardDuty nie jest traktowany jako plik bezpieczny,
- zaszyfrowany PDF kończy się czytelnym błędem,
- cudzy użytkownik nie otrzymuje linku podglądu,
- wygasły upload i link GET nie działają,
- logi nie zawierają fragmentów dokumentu,
- purge usuwa wszystkie wersje wskazanego obiektu.

### 22.5. Testy E2E

Playwright przechodzi przez:

1. utworzenie teczki demo,
2. upload dokumentu,
3. śledzenie statusu,
4. otwarcie podglądu,
5. akceptację propozycji,
6. korektę propozycji,
7. rozwiązanie konfliktu,
8. ponowienie błędu,
9. usunięcie źródła.

## 23. Kryteria odbioru

M2 jest gotowe, gdy:

- pięć teczek demo jest dostępnych,
- minimum 20 materiałów przeszło pipeline,
- minimum 90% jawnych faktów referencyjnych odczytano poprawnie,
- 100% propozycji ma źródło i locator,
- 100% propozycji AI pozostaje niepotwierdzonych do decyzji człowieka,
- wszystkie kontrolowane konflikty są widoczne,
- podwójne zdarzenie nie tworzy duplikatu,
- nieobsługiwany i uszkodzony plik ma czytelny stan błędu,
- plik nie jest przetwarzany przed bezpiecznym wynikiem skanu malware,
- koszt, dostawca, model i czas są zapisane dla każdego zadania,
- treść dokumentów nie pojawia się w logach,
- próba odczytu danych innego użytkownika zwraca `404`,
- testy jednostkowe, integracyjne, E2E i infrastruktury przechodzą,
- lint, TypeScript i build produkcyjny przechodzą,
- pełny przepływ działa najpierw w AWS `dev`,
- po osobnym zatwierdzeniu wdrożenia produkcyjnego pełny przepływ działa na
  głównym adresie Studio.

## 24. Kolejność wdrożenia

1. Model danych i migracja.
2. Repozytorium, serwis i API źródeł.
3. CDK dla bezpiecznego S3 i federacji OIDC.
4. Bezpośredni upload i podgląd.
5. EventBridge, Step Functions oraz idempotencja.
6. Przygotowanie dokumentów i Transcribe.
7. Dwuprzebiegowa ekstrakcja Bedrock.
8. Callback i propozycje.
9. Konflikty oraz decyzje człowieka.
10. Stół weryfikacyjny i widoki mobilne.
11. Retencja, purge, eksport i usunięcie konta.
12. Dane syntetyczne i benchmark.
13. Testy bezpieczeństwa, E2E oraz obserwowalność.
14. Wdrożenie `dev`, odbiór, plan zmian produkcyjnych.
15. Po zatwierdzeniu: wdrożenie `prod` i smoke test.

## 25. Poza zakresem M2

- automatyczna publikacja ogłoszeń i reklam,
- generowanie filmów i avatarów,
- Plot Future Lab,
- Offer Launch Lab,
- Buyer Room,
- automatyczna interpretacja prawna dokumentu,
- rozpoznawanie dokumentów większych niż limity produktu,
- publiczne linki do dokumentów,
- dane prawdziwych klientów w środowisku `dev`.

## 26. Źródła techniczne

- [Amazon S3 — presigned URLs i checksum](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
- [Amazon S3 — kontrola integralności](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html)
- [Amazon Bedrock Converse](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html)
- [Amazon Bedrock — limity wiadomości i dokumentów](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Message.html)
- [Amazon Bedrock — structured outputs](https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-structured-outputs.html)
- [GuardDuty Malware Protection for S3](https://docs.aws.amazon.com/guardduty/latest/ug/gdu-malware-protection-s3.html)
- [Amazon Transcribe — formaty audio](https://docs.aws.amazon.com/transcribe/latest/dg/how-input.html)
- [Amazon Transcribe — język polski](https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html)
- [Vercel OIDC Federation](https://vercel.com/docs/oidc/reference)
- [AWS IAM OIDC Federation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_oidc.html)
