# AWS Account Security Baseline Design

## Cel

Przygotować konto AWS `261965598943` w regionie `eu-central-1` do
pierwszego produkcyjnego wdrożenia Property Intelligence Studio. Baseline ma
być odtwarzalny, testowalny i nie może zależeć od ręcznych zmian w konsoli poza
operacjami root-only.

## Stan wejściowy

- root MFA jest włączone;
- konto root nie ma access keys;
- administrator `akademia-wojtka-admin-darek` ma MFA;
- profil CLI `akademia-ai` wskazuje właściwe konto i użytkownika;
- istnieje account-level budget 25 USD;
- nie istnieje account-level S3 Block Public Access;
- nie istnieją CloudTrail, AWS Config ani `CDKToolkit`;
- GuardDuty nie jest aktywne, a docelowy stack aplikacyjny tworzy osobny plan
  Malware Protection for S3.

## Wybrana architektura

Baseline będzie zarządzany w repo Property Intelligence Studio przez osobny
`AccountSecurityBaselineStack`. Stack jest niezależny od
`PropertySourceStorageStack`, aby rollback aplikacji nie usuwał audytu konta.

Account-level S3 Block Public Access nie ma natywnego zasobu CloudFormation.
Zostanie ustawiony kontrolowanym skryptem, który:

1. wymaga profilu `akademia-ai`;
2. sprawdza konto `261965598943`;
3. wymaga regionu `eu-central-1`;
4. odczytuje stan przed zapisem;
5. włącza wszystkie cztery blokady;
6. odczytuje i porównuje stan po zapisie.

Pozostałe elementy baseline tworzy CDK:

- prywatny bucket logów CloudTrail;
- SSE-KMS z customer-managed key i rotacją;
- versioning oraz lifecycle dla starych wersji i niekompletnych uploadów;
- wieloregionowy CloudTrail dla zdarzeń zarządzania read/write;
- walidacja plików logów;
- AWS Config recorder dla wspieranych zasobów i zasobów globalnych;
- prywatny bucket delivery channel AWS Config;
- cztery managed rules:
  - `s3-bucket-public-read-prohibited`;
  - `s3-bucket-public-write-prohibited`;
  - `iam-user-mfa-enabled`;
  - `cloudtrail-enabled`.

Bucket logów, bucket AWS Config i klucz KMS mają politykę `RETAIN`. Usunięcie
stacka nie może skasować historii ani materiału audytowego.

## Granice uprawnień

CDK bootstrap tworzy standardowe role deploymentu wyłącznie na koncie
`261965598943` i w regionie `eu-central-1`. Deploy jest wykonywany przez
człowieka z aktywną sesją MFA. Aplikacja nie otrzymuje praw do CloudTrail,
AWS Config ani zarządzania publicznym dostępem S3.

AWS Config korzysta z roli przeznaczonej tylko dla recordera i dostarczenia
snapshotów. CloudTrail może zapisywać wyłącznie do dedykowanego prefiksu w
prywatnym bucketcie. Polityki bucketów wymuszają TLS.

## Kolejność wdrożenia

1. Testy szablonu baseline przechodzą cykl red-green.
2. Kontrolowany skrypt włącza account-level S3 Block Public Access.
3. CDK bootstrap tworzy `CDKToolkit` z termination protection.
4. `cdk diff` pokazuje pełny plan baseline.
5. Baseline zostaje wdrożony.
6. Read-only audit potwierdza CloudTrail, AWS Config, reguły, szyfrowanie,
   versioning, retencję, MFA, brak root keys i public block.
7. Dopiero wtedy wykonywany jest `cdk diff` Property Source.
8. Po akceptacji diffu wdrażany jest stack aplikacyjny.

## Obsługa błędów i rollback

- Niepoprawne konto lub region zatrzymują skrypt przed zapisem.
- Błąd bootstrapu albo baseline zatrzymuje wdrożenie aplikacji.
- CloudFormation rollback jest automatyczny; retained buckets i KMS pozostają.
- Account-level Public Access Block jest celowo utrzymywany po rollbacku.
- GuardDuty Malware Protection jest częścią stacka aplikacyjnego, nie baseline.
  Brak możliwości utworzenia planu zatrzymuje aplikacyjny deploy.
- Usunięcie retained danych wymaga osobnej, pisemnej zgody właściciela.

## Koszt

Baseline ma mieścić się w zaakceptowanym limicie około 1–4 USD miesięcznie:

- pierwszy management trail nie ma opłaty za dostarczenie management events;
- S3 przechowuje małą ilość logów z lifecycle;
- customer-managed KMS key kosztuje około 1 USD miesięcznie;
- AWS Config generuje główny koszt zależny od liczby zmian i ewaluacji.

Istniejący budget 25 USD pozostaje głównym alertem account-level. Baseline nie
tworzy drugiego globalnego budżetu.

## Testy i kryteria odbioru

Testy CDK mają potwierdzić:

- CloudTrail jest multi-region, obejmuje read/write management events i ma
  log-file validation;
- oba buckety są prywatne, szyfrowane, wersjonowane, mają lifecycle i politykę
  `RETAIN`;
- klucz KMS ma rotację i politykę `RETAIN`;
- Config recorder obejmuje zasoby wspierane i globalne;
- istnieją dokładnie cztery wymagane managed rules;
- nie powstaje publiczny endpoint ani aplikacyjna rola z dostępem do baseline.

Odbiór produkcyjny wymaga świeżych wyników:

- `AccountMFAEnabled = 1`;
- `AccountAccessKeysPresent = 0`;
- wszystkie cztery pola account-level S3 Block Public Access są `true`;
- `management-trail` ma `IsLogging = true`;
- AWS Config recorder ma status `recording = true`;
- cztery reguły AWS Config istnieją;
- `CDKToolkit` i baseline stack mają status `CREATE_COMPLETE` albo
  `UPDATE_COMPLETE`;
- smoke test logowania i aplikacji nie wykazuje regresji.
