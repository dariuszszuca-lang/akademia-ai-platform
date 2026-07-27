# Chronione źródła nieruchomości w AWS

## Cel

Ten moduł przechowuje dokumenty, zdjęcia i inne źródła ofert poza Vercel Blob.
Przeglądarka wysyła plik bezpośrednio do prywatnego S3, a aplikacja przekazuje
wyłącznie krótko ważny formularz uploadu. Oryginał nie jest dostępny do odczytu,
dopóki GuardDuty nie oznaczy go jako wolny od wykrytych zagrożeń.

Warstwa storage bezpiecznie przyjmuje i skanuje plik. Po czystym wyniku
EventBridge uruchamia osobny, standardowy workflow ekstrakcji. Workflow ma
izolowane workery do startu, callbacku, walidacji i przygotowania pliku, mapy
dowodów oraz propozycji faktów.

## Przepływ

1. Zalogowany użytkownik rejestruje źródło przy nieruchomości.
2. API weryfikuje organizację, nieruchomość, MIME, rozmiar i SHA-256.
3. Vercel wymienia token OIDC na krótkotrwałą sesję roli AWS.
4. API podpisuje pięciominutowy POST dla jednego, nieprzewidywalnego klucza.
5. Przeglądarka wysyła plik bezpośrednio do S3 wraz z checksumą i SSE-KMS.
6. GuardDuty skanuje wyłącznie prefiks `originals/` i zapisuje swój status.
7. Polityka bucketa blokuje odczyt do czasu uzyskania
   `GuardDutyMalwareScanStatus=NO_THREATS_FOUND`.
8. API może wystawić minutowy link do pobrania dopiero po ponownym sprawdzeniu
   tenantu, statusu aplikacyjnego i tagu skanu.
9. EventBridge przekazuje wynik GuardDuty tylko dla wybranego bucketa i
   prefiksu `originals/`.
10. Starter używa deterministycznej nazwy wykonania, więc ponowne dostarczenie
    tego samego zdarzenia nie tworzy drugiej pracy.
11. Callback HMAC pobiera minimalny kontekst źródła z aplikacji, bez dostępu
    AWS do PostgreSQL.
12. Walidator ponownie sprawdza rozmiar, SHA-256, tag skanu, sygnaturę oraz
    strukturę pliku.
13. PDF, DOCX, XLSX, CSV i obrazy są przygotowywane do limitów Bedrock w
    `work/`; pliki pochodne wygasają po 7 dniach.
14. Bedrock najpierw tworzy mapę dowodów, a potem — w osobnym wywołaniu —
    propozycje z dozwolonego katalogu. AI nigdy nie potwierdza faktu.
15. Wynik wraca podpisanym callbackiem i trafia do stołu weryfikacyjnego.
    Po wyczerpaniu ograniczonych prób błąd techniczny również wraca bezpiecznym
    callbackiem jako `EXTRACTION_FAILED`, więc zadanie nie pozostaje w stanie
    „w toku”.

Klucze obiektów nie zawierają nazwy pliku, adresu nieruchomości ani danych
klienta:

```text
originals/organizations/<organizationId>/properties/<propertyId>/sources/<sourceId>/original
```

## Zabezpieczenia

- region jest wymuszony jako `eu-central-1`;
- bucket jest prywatny, wersjonowany, szyfrowany kluczem KMS i wymaga TLS;
- własność obiektów pozostaje po stronie właściciela bucketa;
- upload wiąże dokładny klucz, MIME, rozmiar, checksumę, KMS i identyfikator
  źródła;
- rola Vercel nie może listować bucketa, zmieniać tagów skanu ani uruchamiać
  usług AI;
- trust OIDC dopuszcza wyłącznie jawne projekty i środowiska, bez wildcardów;
- wyłącznie rola GuardDuty może zmieniać `GuardDutyMalwareScanStatus`;
- wymóg czystego tagu dotyczy tylko oryginałów; `work/` odczytują wyłącznie
  dokładnie wskazane role pipeline;
- `work/` i `transcripts/` wygasają po 7 dniach, stare wersje po 90 dniach;
- bucket i klucz mają `RemovalPolicy.RETAIN`, więc usunięcie stacka nie usuwa
  danych;
- workflow jest typu Standard, ma ograniczone retry, catch, alarmy i DLQ;
- workery Bedrock mogą wywołać wyłącznie zatwierdzony profil EU Claude Haiku
  4.5 i jego sześć jawnych regionów docelowych;
- callback może odczytać wyłącznie jeden sekret w Secrets Manager;
- wynik zadania zapisuje model, tokeny, łączny czas odpowiedzi i estymowany
  koszt dostawcy;
- Lambdy mają dedykowane logi z retencją 3 dni w dev i 14 dni w prod;
- natywne logowanie Step Functions jest wyłączone, bo AWS wymaga dla niego
  `Resource: "*"`, czego polityka COSTSEC zabrania. Historia wykonań Standard,
  metryki, alarmy i logi workerów pozostają dostępne.

## Obsługiwane ścieżki

- PDF: do 100 stron; bezpośrednio do 4,5 MB albo podział na maksymalnie
  20 stron na część, z przeliczeniem numeru strony na oryginał;
- DOCX: tylko akapity i tabele z `word/document.xml`; obiekty osadzone są
  ignorowane;
- XLSX: tylko widoczne arkusze i zapisane wartości komórek; formuły nie są
  wykonywane, a dowód zachowuje arkusz, wiersz i kolumnę;
- CSV/TXT: UTF-8, automatyczne rozpoznanie przecinka, średnika lub tabulatora
  i dzielenie na części bez przekroczenia limitu modelu;
- JPEG/PNG/WebP: bezpośrednio w limicie albo normalizacja do WebP poniżej
  3,75 MB i 8000 px;
- audio: upload i walidacja są obsługiwane, ale automatyczna transkrypcja jest
  obecnie zamknięta bramką polityki i trafia do ręcznej weryfikacji.

Amazon Transcribe wymaga dla `StartTranscriptionJob` uprawnienia
`Resource: "*"`. Jest to sprzeczne z obowiązującą polityką COSTSEC, dlatego
stack nie zawiera tego uprawnienia. Automatyczne `pl-PL` można uruchomić dopiero
po jawnie zatwierdzonym wyjątku bezpieczeństwa albo po wyborze usługi, która
pozwala ograniczyć dostęp do dokładnego zasobu.

## Konfiguracja syntezy

Wartości poniżej są identyfikatorami, nie sekretami:

```dotenv
STUDIO_ENV=dev
CDK_DEFAULT_ACCOUNT=111122223333
CDK_DEFAULT_REGION=eu-central-1
VERCEL_TEAM_SLUG=example-team
VERCEL_PROJECT_NAMES=akademia-ai-platform
VERCEL_OIDC_ENVIRONMENTS=development,preview
STUDIO_CALLBACK_BASE_URL=https://akademia-ai-platform.vercel.app
PROPERTY_SOURCE_PIPELINE_VERSION=property-source-v1
PROPERTY_SOURCE_BEDROCK_MODEL_ID=eu.anthropic.claude-haiku-4-5-20251001-v1:0
BILLING_ALERT_EMAIL=alerts@example.com
# Opcjonalnie, gdy provider zespołu już istnieje:
VERCEL_OIDC_PROVIDER_ARN=
# Opcjonalnie, gdy sekret callbacku już istnieje:
PROPERTY_SOURCE_CALLBACK_SECRET_ARN=
```

Środowisko `prod` akceptuje wyłącznie `production` i wymaga adresu alertów.
Podczas kontrolowanej zmiany nazwy projektu można podać kilka nazw po
przecinku. Każda tworzy osobny, dokładny subject OIDC.

Lokalna synteza nie wykonuje zapytań do konta AWS:

```bash
STUDIO_ENV=dev \
CDK_DEFAULT_ACCOUNT=111122223333 \
CDK_DEFAULT_REGION=eu-central-1 \
VERCEL_TEAM_SLUG=example-team \
VERCEL_PROJECT_NAMES=akademia-ai-platform \
VERCEL_OIDC_ENVIRONMENTS=development,preview \
STUDIO_CALLBACK_BASE_URL=https://akademia-ai-platform.vercel.app \
PROPERTY_SOURCE_PIPELINE_VERSION=property-source-v1 \
PROPERTY_SOURCE_BEDROCK_MODEL_ID=eu.anthropic.claude-haiku-4-5-20251001-v1:0 \
BILLING_ALERT_EMAIL=alerts@example.com \
npm run infra:synth
```

## Wdrożenie

Przed każdym `cdk diff`, `bootstrap` lub `deploy` trzeba ponownie wykonać
preflight bezpieczeństwa chmury opisany w workspace AI-Team. Wdrożenie
produkcyjne wymaga osobnej zgody Darka.

### Bramka chmurowa

Przed pierwszym poleceniem korzystającym z konta:

1. ponownie przeczytać `.claude/rules/cloud_safety.md`;
2. ponownie przeczytać `.claude/rules/credential-protection.md`;
3. przeczytać `PROJEKTY/AUTOFIRMA/COSTSEC/docs/CLOUD_SAFETY.md`;
4. przeczytać `PROJEKTY/AUTOFIRMA/COSTSEC/docs/ZASADY.md`;
5. sprawdzić `DATA/api-inventory.md`;
6. potwierdzić czysty working tree i zapisać hash rollbacku;
7. wykonać `aws sts get-caller-identity` bez wypisywania credentiali;
8. potwierdzić oczekiwane konto i region `eu-central-1`;
9. zinwentaryzować istniejące providery OIDC, buckety, klucze KMS, plany
   GuardDuty, budżety oraz bootstrap CDK;
10. wybrać import lub utworzenie providera OIDC bez duplikacji;
11. wykonać `cdk diff` i ręcznie sprawdzić zasoby, IAM oraz koszty;
12. poinformować Darka przed wdrożeniem `dev` z danymi syntetycznymi.

Produkcja pozostaje zablokowana do osobnego, jawnego potwierdzenia.

### Kolejność wdrożenia dev

1. potwierdzić konto, region, środowisko i brak szerszych uprawnień;
2. sprawdzić, czy provider `oidc.vercel.com/<team>` już istnieje;
3. aktywować tagi alokacji kosztów `CostCenter` oraz `Env`;
4. wykonać lokalny synth i przejrzeć template;
5. wykonać `cdk diff` na właściwym koncie;
6. wdrożyć najpierw stack `dev`;
7. zapisać outputy bucketa, KMS, roli, regionu, state machine i wersji
   pipeline w konfiguracji wdrożenia;
8. ustawić dla tokenu Vercel OIDC audience `sts.amazonaws.com`;
9. skopiować wartość wygenerowanego sekretu callbacku bezpośrednio z
   Secrets Manager do chronionej zmiennej Vercel. Nie przenosić jej przez
   czat, log ani repo;
10. przesłać syntetyczny plik i sprawdzić skan, blokadę przed skanem,
    pojedyncze wykonanie workflow oraz pobranie po czystym wyniku;
11. dopiero po smoke teście rozważyć osobny stack `prod`.

Procedurę z plikiem testującym detekcję malware wolno wykonać tylko wtedy,
gdy aktualne zasady bezpieczeństwa chmury wprost na to pozwalają. W innym
przypadku smoke test używa wyłącznie nieszkodliwego, syntetycznego PDF.

Oficjalne źródła:

- [Vercel OIDC](https://vercel.com/docs/oidc/reference)
- [GuardDuty Malware Protection for S3](https://docs.aws.amazon.com/guardduty/latest/ug/malware-protection-s3.html)
- [Tag-based access control](https://docs.aws.amazon.com/guardduty/latest/ug/tag-based-access-s3-malware-protection.html)
- [Step Functions i CloudWatch Logs](https://docs.aws.amazon.com/step-functions/latest/dg/cw-logs.html)
- [Claude Haiku 4.5 w Bedrock i regiony profilu EU](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-4-5.html)
- [IAM Amazon Transcribe](https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazontranscribe.html)

## Reakcja na problemy

- `THREATS_FOUND`: nie udostępniać obiektu, oznaczyć źródło jako
  `quarantined`;
- `UNSUPPORTED`, `ACCESS_DENIED` lub `FAILED`: zablokować odczyt i skierować
  źródło do ręcznej obsługi;
- brak tagu: traktować jako „jeszcze nieskanowane”, nigdy jako czyste;
- błędny trust OIDC: nie poszerzać subjectu wildcardem; poprawić dokładną nazwę
  zespołu, projektu lub środowiska;
- błąd kosztowy: zatrzymać nowe uploady aplikacyjnie i sprawdzić Cost Explorer.

Usunięcie stacka nie usuwa bucketa ani klucza. Ich późniejsze usunięcie jest
osobną, destrukcyjną operacją wymagającą inwentaryzacji danych i jawnej zgody.
