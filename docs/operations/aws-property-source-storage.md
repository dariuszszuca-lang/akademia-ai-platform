# Chronione źródła nieruchomości w AWS

## Cel

Ten moduł przechowuje dokumenty, zdjęcia i inne źródła ofert poza Vercel Blob.
Przeglądarka wysyła plik bezpośrednio do prywatnego S3, a aplikacja przekazuje
wyłącznie krótko ważny formularz uploadu. Oryginał nie jest dostępny do odczytu,
dopóki GuardDuty nie oznaczy go jako wolny od wykrytych zagrożeń.

Moduł nie uruchamia ekstrakcji AI. Jego jedynym zadaniem jest bezpieczne
przyjęcie, przeskanowanie i udostępnienie czystego pliku dalszym procesom.

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
- `work/` i `transcripts/` wygasają po 7 dniach, stare wersje po 90 dniach;
- bucket i klucz mają `RemovalPolicy.RETAIN`, więc usunięcie stacka nie usuwa
  danych.

## Konfiguracja syntezy

Wartości poniżej są identyfikatorami, nie sekretami:

```dotenv
STUDIO_ENV=dev
CDK_DEFAULT_ACCOUNT=111122223333
CDK_DEFAULT_REGION=eu-central-1
VERCEL_TEAM_SLUG=example-team
VERCEL_PROJECT_NAMES=akademia-ai-platform
VERCEL_OIDC_ENVIRONMENTS=development,preview
BILLING_ALERT_EMAIL=alerts@example.com
# Opcjonalnie, gdy provider zespołu już istnieje:
VERCEL_OIDC_PROVIDER_ARN=
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
BILLING_ALERT_EMAIL=alerts@example.com \
npm run infra:synth
```

## Wdrożenie

Przed każdym `cdk diff`, `bootstrap` lub `deploy` trzeba ponownie wykonać
preflight bezpieczeństwa chmury opisany w workspace AI-Team. Wdrożenie
produkcyjne wymaga osobnej zgody Darka.

Kolejność wdrożenia:

1. potwierdzić konto, region, środowisko i brak szerszych uprawnień;
2. sprawdzić, czy provider `oidc.vercel.com/<team>` już istnieje;
3. aktywować tagi alokacji kosztów `CostCenter` oraz `Env`;
4. wykonać lokalny synth i przejrzeć template;
5. wykonać `cdk diff` na właściwym koncie;
6. wdrożyć najpierw stack `dev`;
7. zapisać outputy bucketa, KMS, roli i regionu w zmiennych projektu Vercel;
8. ustawić dla tokenu Vercel OIDC audience `sts.amazonaws.com`;
9. przesłać syntetyczny plik i sprawdzić skan, blokadę przed skanem oraz
   pobranie po czystym wyniku;
10. dopiero po smoke teście rozważyć osobny stack `prod`.

Oficjalne źródła:

- [Vercel OIDC](https://vercel.com/docs/oidc/reference)
- [GuardDuty Malware Protection for S3](https://docs.aws.amazon.com/guardduty/latest/ug/malware-protection-s3.html)
- [Tag-based access control](https://docs.aws.amazon.com/guardduty/latest/ug/tag-based-access-s3-malware-protection.html)

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
