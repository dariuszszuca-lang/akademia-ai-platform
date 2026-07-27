# Koszty storage źródeł: założenia pilota

Stan źródeł i stawek sprawdzono 27 lipca 2026. Ten dokument nie jest obietnicą
rachunku. Ceny zależą od regionu, liczby wersji, requestów, wielkości skanów i
transferu.

## Scenariusz pilota

- 200 nowych plików miesięcznie;
- średnio 10 MB na plik;
- około 2 GB nowych oryginałów miesięcznie;
- jeden prywatny bucket na środowisko;
- jeden zarządzany przez klienta klucz KMS na środowisko;
- jeden sekret callbacku w Secrets Manager na środowisko;
- skan każdego nowego obiektu w `originals/`;
- jedno standardowe wykonanie Step Functions na czysty obiekt;
- krótkie wywołania Lambd, EventBridge oraz awaryjna kolejka SQS;
- pliki robocze i transkrypcje usuwane po 7 dniach;
- stare wersje obiektów usuwane po 90 dniach.

Po 12 miesiącach same oryginały mogą zajmować około 24 GB, jeśli nic nie
zostanie usunięte. To założenie pojemności, a nie wycena.

## Fakty z oficjalnych cenników

- KMS nalicza opłatę miesięczną za każdy klucz zarządzany przez klienta.
  Oficjalny cennik podaje obecnie 1 USD miesięcznie za klucz oraz rozlicza
  operacje ponad bezpłatny miesięczny próg. Rotacja może zwiększać koszt
  materiału klucza.
- Malware Protection for S3 ma miesięczny bezpłatny próg obejmujący obecnie
  1 GB skanowanych danych i 1000 żądań. Opłaty powyżej progu zależą od regionu.
- S3 rozlicza przechowywanie, żądania, pobieranie i część transferu według
  regionu i klasy storage.
- Budżet AWS wysyła alert. Nie jest limitem wydatków i sam nie zatrzymuje
  zasobów.
- Secrets Manager, Step Functions, Lambda, EventBridge, SQS, CloudWatch
  Alarms i Dashboard są rozliczane według własnych cenników. Ich udział trzeba
  zweryfikować po pilocie na realnej liczbie wykonań.
- Standardowy Claude Sonnet 4.6 kosztuje obecnie 3 USD za milion tokenów
  wejściowych i 15 USD za milion tokenów wyjściowych. Pipeline zapisuje
  estymację w mikrojednostkach USD: 3 na token wejściowy i 15 na wyjściowy.
  Rzeczywisty rachunek pozostaje źródłem rozstrzygającym.

Źródła:

- [AWS KMS Pricing](https://aws.amazon.com/kms/pricing/)
- [Amazon GuardDuty Pricing](https://aws.amazon.com/guardduty/pricing/)
- [Amazon S3 Pricing](https://aws.amazon.com/s3/pricing/)
- [AWS Budgets](https://aws.amazon.com/aws-cost-management/aws-budgets/)
- [AWS Secrets Manager Pricing](https://aws.amazon.com/secrets-manager/pricing/)
- [AWS Step Functions Pricing](https://aws.amazon.com/step-functions/pricing/)
- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [Amazon EventBridge Pricing](https://aws.amazon.com/eventbridge/pricing/)
- [Amazon SQS Pricing](https://aws.amazon.com/sqs/pricing/)
- [Amazon CloudWatch Pricing](https://aws.amazon.com/cloudwatch/pricing/)
- [Amazon Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
- [AWS: telemetria kosztów Bedrock](https://aws.amazon.com/blogs/aws-cloud-financial-management/optimize-llm-costs-on-amazon-bedrock-from-billing-attribution-to-operational-telemetry/)

## Wniosek operacyjny

Najmniejszym stałym składnikiem jest klucz KMS. Storage i skanowanie rosną z
liczbą oraz rozmiarem plików. Przed wdrożeniem trzeba policzyć wariant
`eu-central-1` w AWS Pricing Calculator, ponieważ przykład z innego regionu
nie jest wiarygodną wyceną dla Frankfurtu.

Stack tworzy miesięczne alerty:

- `dev`: 10 USD;
- `prod`: 25 USD;
- progi: 50%, 80% i 100% faktycznego kosztu.

Budżety filtrują zasoby po tagach `CostCenter=PropertyStudio` i odpowiednim
`Env`. Tagi alokacji kosztów trzeba aktywować w Billing przed poleganiem na
tych alertach. Dodatkowy budżet całego konta pozostaje rekomendowaną drugą
linią ochrony, ponieważ nie każdy koszt usługi musi być przypisany do tagu.

## Co mierzyć po uruchomieniu

- liczbę i sumaryczny rozmiar uploadów dziennie;
- średni rozmiar pliku i odsetek ponownych uploadów;
- liczbę requestów S3 i operacji KMS;
- liczbę wykonań i przejść stanów Step Functions;
- liczbę wywołań, błędów i czas Lambd;
- tokeny wejściowe/wyjściowe, czas odpowiedzi modeli i estymowany koszt
  Bedrock na zadanie;
- liczbę wiadomości w DLQ;
- GB przeskanowane przez GuardDuty;
- obiekty bez wyniku skanu po oczekiwanym czasie;
- koszt na źródło i koszt na aktywną nieruchomość;
- odchylenie od scenariusza 200 × 10 MB.

Pierwszy przegląd kosztów należy zrobić po 24 godzinach, kolejny po 7 dniach,
a potem co miesiąc. Jeśli alert 80% uruchomi się przed połową miesiąca, nowe
uploady należy czasowo ograniczyć i ustalić przyczynę przed podniesieniem
budżetu.
