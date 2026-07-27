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
- skan każdego nowego obiektu w `originals/`;
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

Źródła:

- [AWS KMS Pricing](https://aws.amazon.com/kms/pricing/)
- [Amazon GuardDuty Pricing](https://aws.amazon.com/guardduty/pricing/)
- [Amazon S3 Pricing](https://aws.amazon.com/s3/pricing/)
- [AWS Budgets](https://aws.amazon.com/aws-cost-management/aws-budgets/)

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
- GB przeskanowane przez GuardDuty;
- obiekty bez wyniku skanu po oczekiwanym czasie;
- koszt na źródło i koszt na aktywną nieruchomość;
- odchylenie od scenariusza 200 × 10 MB.

Pierwszy przegląd kosztów należy zrobić po 24 godzinach, kolejny po 7 dniach,
a potem co miesiąc. Jeśli alert 80% uruchomi się przed połową miesiąca, nowe
uploady należy czasowo ograniczyć i ustalić przyczynę przed podniesieniem
budżetu.
