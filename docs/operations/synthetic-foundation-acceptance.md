# Odbiór syntetyczny fundamentu Studio

## Zakres

Runbook obejmuje kontrolowany odbiór produkcyjny fundamentu Property
Intelligence Studio na danych wyłącznie syntetycznych. Nie zastępuje pilota z
prawdziwymi agentami ani dowodu wartości biznesowej, retencji lub czasu pracy.

Korpus odbiorczy zawiera:

- 5 syntetycznych teczek nieruchomości;
- 20 materiałów w obsługiwanych formatach;
- 54 jawnie zdefiniowane fakty referencyjne;
- 5 kontrolowanych konfliktów.

Model produkcyjny pozostaje bez zmian:
`eu.anthropic.claude-sonnet-4-6`.

## Stan produkcyjny po wdrożeniu A1

Wdrożenie z 28 lipca 2026 r.:

- commit produkcyjny: `cedf0e1`;
- rollback aplikacji: `2648392`;
- stack: `PropertySourceStorage-prod`, status `UPDATE_COMPLETE`;
- ochrona stacka przed usunięciem: włączona;
- migracja: `0006_studio_product_events`, zastosowana i idempotentna;
- nowy output CloudFormation:
  `PropertySourceDeletionRoleArn`;
- rola usuwania ufa wyłącznie produkcyjnemu subjectowi Vercel tego projektu;
- rola może listować wersje wyłącznie w prefiksie
  `originals/organizations/*` oraz usuwać obiekty i ich wersje w tym prefiksie;
- rola nie ma dołączonych polityk zarządzanych;
- domena produkcyjna: `https://akademia-ai-platform.vercel.app`;
- `/start` i `/login`: HTTP 200;
- alarmy w stanie `ALARM`: 0;
- wiadomości widoczne i przetwarzane w DLQ: 0/0;
- błędy runtime i odpowiedzi 5xx nowego wdrożenia Vercel: 0/0;
- kontrolny `cdk diff`: 0 różnic.

Backup Neon wykonano przed migracją i zweryfikowano przez odczyt katalogu
`pg_restore`. Kopia znajduje się lokalnie poza repozytorium i iCloud, z
uprawnieniami właściciela. Runbook nie zapisuje connection stringa ani żadnej
wartości sekretnej.

Pełny smoke uwierzytelnionych zakładek `Przegląd`, `Źródła`, `Braki` i
`Historia` oraz izolacja cudzej teczki 404 są częścią osobnego benchmarku
produkcyjnego. Do czasu jego przejścia fundament nie otrzymuje statusu
„gotowy do M3”.

## Bramka przed uruchomieniem benchmarku

Przed każdą próbą trzeba ponownie:

1. przeczytać obowiązujące zasady cloud safety i ochrony sekretów;
2. potwierdzić profil `akademia-ai`, konto `261965598943` i region
   `eu-central-1`;
3. potwierdzić aktywne MFA roota, brak kluczy roota, Account Public Access
   Block 4/4, działający CloudTrail i AWS Config;
4. odczytać bieżące koszty oraz alarmy;
5. uzyskać od Darka osobną, jawną zgodę na benchmark do 3 USD.

## Limity produkcyjnego przebiegu

- maksymalnie 20 uploadów i 100 MB;
- miękki stop przy prognozie 2,50 USD;
- twardy limit 3 USD;
- wyłącznie syntetyczny użytkownik i jednoznaczny `run-id`;
- automatyczne sprzątanie w bloku `finally`;
- żadnego automatycznego potwierdzania propozycji AI.

Polecenie wolno uruchomić dopiero po przejściu bramki i osobnej zgodzie:

```bash
AWS_PROFILE=akademia-ai \
npm run studio:acceptance:prod -- \
  --allow-production-synthetic \
  --base-url https://akademia-ai-platform.vercel.app \
  --max-cost-usd 3
```

## Kryteria odbioru

Przebieg jest zaakceptowany tylko wtedy, gdy jednocześnie:

- 5 przypadków i 20 materiałów zostało obsłużonych;
- precyzja faktów wynosi co najmniej 90%;
- pokrycie locatorów wynosi 100%;
- wykryto 5/5 kontrolowanych konfliktów;
- nie potwierdzono automatycznie żadnej propozycji;
- nie powstały duplikaty;
- koszt nie przekroczył 3 USD;
- cleanup usunął użytkownika Cognito, dane w bazie oraz wszystkie wersje i
  delete markery dokładnego prefiksu S3;
- DLQ pozostała pusta, a wszystkie alarmy są `OK`.

## Sprzątanie i sytuacja awaryjna

Runner utrzymuje rejestr utworzonych identyfikatorów i wykonuje cleanup nawet
po błędzie etapu lub checkpointu. Po niepełnym cleanupie nie wolno uruchamiać
kolejnej próby. Najpierw należy niezależnie potwierdzić i dokończyć usunięcie:

1. syntetycznego użytkownika Cognito;
2. organizacji i wszystkich zależnych rekordów Postgres;
3. wszystkich wersji oraz delete markerów dokładnego prefiksu S3;
4. pozostałych wiadomości DLQ.

Ręczne sprzątanie jest operacją produkcyjną i wymaga odrębnego potwierdzenia
zakresu. Nie wolno poszerzać prefiksu ani wykonywać zbiorczego czyszczenia
bucketa.

## Rollback

- aplikacja: powrót do commita `2648392`;
- baza: addytywna tabela `studio_product_events` pozostaje nieużywana;
- IAM: kontrolowany revert zmian CDK i ponowny deploy po osobnej zgodzie;
- Account Public Access Block, baseline bezpieczeństwa, dane audytowe i
  zasoby z polityką `RETAIN` nie są wyłączane przez rollback aplikacji.
