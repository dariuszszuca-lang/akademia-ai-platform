# Property Intelligence Studio: syntetyczny odbiór fundamentu

Status: zaakceptowany kierunek, specyfikacja do odbioru przed planem wdrożenia
Data: 2026-07-28

## 1. Decyzja

Przed rozpoczęciem Plot Future Lab domykamy Property Truth Engine i moduł
Źródeł na kontrolowanych danych syntetycznych. Etap obejmuje:

- pięć syntetycznych teczek nieruchomości;
- dwadzieścia materiałów testowych;
- minimum pięćdziesiąt faktów referencyjnych;
- minimum pięć kontrolowanych sprzeczności;
- brakujące widoki „Braki i konflikty” oraz „Historia zmian”;
- podstawową instrumentację produktu;
- powtarzalny benchmark dokładności, czasu i kosztu;
- test produkcyjny w izolowanym kontekście syntetycznym z pełnym sprzątaniem.

Nie rozpoczynamy M4, dopóki fundament nie przejdzie kryteriów opisanych w tej
specyfikacji.

## 2. Cel

Po zakończeniu etapu Darek ma mieć technicznie zweryfikowany fundament gotowy
do pilotażu M3. System ma udowodnić, że:

1. teczki, fakty, braki, konflikty i historia tworzą spójny model;
2. dokument przechodzi bezpiecznie od uploadu do propozycji;
3. propozycje AI są mierzalne i nigdy nie stają się faktami bez człowieka;
4. izolacja organizacji, eksport i usuwanie obejmują wszystkie dane Studio;
5. koszt i czas przetwarzania są znane;
6. syntetyczne dane można usunąć bez pozostawienia obiektów, wersji i kont
   technicznych.

## 3. Granice etapu

### W zakresie

- syntetyczne mieszkania, dom i działki;
- PDF, JPEG/PNG, DOCX, XLSX, CSV i TXT w granicach obecnego kontraktu;
- fakty jawne, braki, konflikty i dane o różnym poziomie kompletności;
- istniejący Bedrock Sonnet 4.6, GuardDuty, Step Functions i callback;
- UI braków i historii;
- zdarzenia produktu potrzebne do późniejszego pomiaru M3;
- raport benchmarku bez danych osobowych;
- automatyczne sprzątanie syntetycznego przebiegu;
- dokumentacja odbioru i jawna lista odchyleń od roadmapy.

### Poza zakresem

- prawdziwe dokumenty klientów i agentów;
- automatyczna publikacja materiałów;
- Plot Future Lab, Offer Launch Lab i Buyer Room;
- automatyczne zatwierdzanie propozycji;
- nowe modele AI i fallback do modelu droższego niż Sonnet 4.6;
- aktywacja Amazon Transcribe z polityką wymagającą `Resource: "*"`;
- zmiana cen, planów Vercel, Neon albo budżetu AWS.

Nagrania pozostają obsługiwanym formatem wejścia, ale kończą się czytelnym
stanem ręcznej weryfikacji. Pełna transkrypcja wymaga osobnej decyzji
bezpieczeństwa i kosztu.

## 4. Syntetyczny korpus

Korpus ma być deterministyczny i wersjonowany w repo. Nie może zawierać danych
skopiowanych z prawdziwych ofert, dokumentów ani ksiąg wieczystych.

### Teczki

| Kod | Typ | Charakter przypadku |
|---|---|---|
| `SYN-M-01` | mieszkanie | kompletne dane i zgodne źródła |
| `SYN-M-02` | mieszkanie | braki oraz dwie sprzeczności |
| `SYN-D-01` | dom | dane mieszane: dokument, tabela i notatka |
| `SYN-P-01` | działka | dobre pokrycie danych |
| `SYN-P-02` | działka | niepełne dane i trzy sprzeczności |

### Materiały

Każda teczka ma cztery materiały, łącznie dwadzieścia. Korpus obejmuje:

- pięć PDF;
- trzy obrazy;
- trzy DOCX;
- trzy XLSX;
- trzy CSV;
- trzy TXT.

Materiały zawierają różne formaty liczb, jednostek i dat. Co najmniej dwa są
celowo nieczytelne albo nieobsługiwane na poziomie treści, aby sprawdzić
czytelny stan błędu. Żaden plik nie przekracza 5 MB, a cały korpus nie
przekracza 100 MB.

### Fakty referencyjne

Manifest dla każdego materiału zapisuje:

- klucz faktu z katalogu produktu;
- oczekiwaną wartość i typ;
- jednostkę;
- locator;
- identyfikator dowodu;
- informację, czy fakt tworzy kontrolowany konflikt;
- dopuszczalne warianty zapisu wartości.

Łącznie manifest zawiera minimum pięćdziesiąt jawnych faktów referencyjnych
i minimum pięć konfliktów.

## 5. Widok „Braki i konflikty”

Widok korzysta z istniejących faktów oraz propozycji. Nie tworzy drugiego
źródła prawdy.

Pokazuje:

- fakty ze statusem `missing`;
- fakty ze statusem `conflicting`;
- propozycje `conflict` i `needs_review`;
- źródła oraz dowody po obu stronach konfliktu;
- osobę lub źródło, które może rozstrzygnąć brak;
- następne działanie: uzupełnij fakt, przejdź do źródła albo rozstrzygnij
  propozycję.

Filtrowanie odbywa się po stronie tenant-scoped serwisu. Próba otwarcia
cudzej teczki zwraca 404.

## 6. Widok „Historia zmian”

Widok jest projekcją istniejącego dziennika audytowego. Nie wolno logować
pełnej treści dokumentu ani wartości sekretów.

Każdy wpis pokazuje:

- czas;
- typ aktora;
- bezpieczną etykietę akcji;
- typ i identyfikator obiektu;
- zmianę statusu lub kategorii;
- odnośnik do faktu, źródła albo propozycji, jeśli obiekt nadal istnieje.

Pełne wartości faktów nie są kopiowane do zdarzeń analitycznych. Historia
może korzystać z bezpiecznych snapshotów istniejącego audytu tylko w obrębie
organizacji.

## 7. Instrumentacja produktu

Dodajemy append-only tabelę `studio_product_events`. Zdarzenie zawiera:

- `id`;
- `organization_id`;
- `user_id`;
- opcjonalny `property_project_id`;
- nazwę zdarzenia z zamkniętego katalogu;
- wersję kontraktu;
- bezpieczne metadane liczbowe albo kategoryczne;
- `created_at`.

Pierwszy katalog zdarzeń:

- `studio.session_started`;
- `property.created`;
- `property.opened`;
- `fact.created`;
- `fact.updated`;
- `source.registered`;
- `source.review_ready`;
- `proposal.decided`;
- `property.ready_reached`;
- `account.exported`;
- `account.deleted`.

Metadane nie zawierają adresów, nazw plików, treści faktów, locatorów ani
tekstów dokumentów. API nie przyjmuje dowolnej nazwy zdarzenia od klienta;
zdarzenia emituje serwer po zakończonej operacji domenowej.

## 8. Benchmark

Benchmark jest kontrolowanym narzędziem operatorskim, a nie funkcją dla
użytkownika.

### Tryby

- `local`: weryfikuje manifest, generowanie plików, scoring i sprzątanie bez
  wywołań chmurowych;
- `production-synthetic`: używa istniejącego produkcyjnego pipeline w
  dedykowanej organizacji i użytkowniku syntetycznym.

Tryb produkcyjny wymaga:

- potwierdzenia konta `261965598943`;
- regionu `eu-central-1`;
- profilu `akademia-ai`;
- aktywnej sesji MFA;
- jawnego przełącznika `--allow-production-synthetic`;
- limitu kosztu 3 USD;
- prefiksu `synthetic-acceptance/<run-id>/`;
- procedury sprzątania uruchamianej także po błędzie.

### Scoring

Raport oblicza:

- precyzję odczytu faktów referencyjnych;
- pokrycie locatorów i dowodów;
- liczbę prawidłowo wykrytych konfliktów;
- liczbę fałszywych konfliktów;
- czas każdego pliku i całego przebiegu;
- koszt dostawcy oraz model;
- liczbę duplikatów po ponownym dostarczeniu zdarzenia;
- liczbę błędów według kodu.

Próg odbioru:

- minimum 90% jawnych faktów referencyjnych;
- 100% propozycji ma źródło i locator;
- 100% propozycji pozostaje niepotwierdzone;
- 5/5 kontrolowanych konfliktów jest widocznych;
- ponowne zdarzenie nie tworzy drugiego workflow ani propozycji;
- koszt całego przebiegu nie przekracza 3 USD.

Benchmark zatrzymuje dalsze uploady, gdy prognozowany koszt osiąga 2,50 USD.
Przekroczenie 3 USD jest błędem odbioru i wymaga osobnej zgody przed ponownym
uruchomieniem.

## 9. Przepływ danych

```text
manifest syntetyczny
        │
        ▼
generator plików ──► walidacja lokalna ──► raport bez chmury
        │
        └── tryb production-synthetic
                    │
                    ▼
     organizacja i użytkownik syntetyczny
                    │
                    ▼
       rejestracja źródła → prywatny S3
                    │
                    ▼
      GuardDuty → Step Functions → Bedrock
                    │
                    ▼
        propozycje do ręcznej weryfikacji
                    │
                    ▼
       scoring → raport → pełne sprzątanie
```

Raport nie zawiera treści dokumentów. Może zawierać wyłącznie kody
syntetycznych przypadków, identyfikatory przebiegu, metryki i kody błędów.

## 10. Sprzątanie i rollback

Każdy przebieg zapisuje rejestr utworzonych zasobów logicznych. W bloku
`finally` narzędzie:

1. usuwa rekordy syntetycznej organizacji z PostgreSQL;
2. usuwa użytkownika Cognito;
3. usuwa wszystkie wersje obiektów spod prefiksu przebiegu;
4. potwierdza brak widocznych i niebieżących wersji;
5. sprawdza DLQ i alarmy;
6. zachowuje wyłącznie zanonimizowany raport.

Błąd sprzątania kończy komendę statusem niezerowym i wypisuje wyłącznie
identyfikatory zasobów wymagających interwencji. Nie uruchamia szerokiego
kasowania ani operacji poza dedykowanym prefiksem i organizacją.

Rollback kodu odbywa się przez `git revert` ostatniego commita etapu. Migracja
instrumentacji jest addytywna; przy rollbacku kodu tabela może pozostać
nieużywana. Baseline AWS, bucket i aktywny klucz KMS nie są usuwane.

## 11. Bezpieczeństwo

- wyłącznie dane syntetyczne;
- zero prawdziwych adresów, numerów ksiąg, PESEL, podpisów i danych kontaktowych;
- zero sekretów w raporcie, logach i argumentach poleceń;
- istniejący GuardDuty pozostaje bramką przed przetwarzaniem;
- tenant isolation jest testowane dwoma użytkownikami w dwóch organizacjach;
- test destrukcyjny może usuwać tylko zasoby z bieżącego `run-id`;
- produkcyjny benchmark nie zmienia faktów istniejących użytkowników;
- transkrypcja pozostaje za bramką bezpieczeństwa;
- każda operacja cloud wymaga aktualnego odczytu zasad COSTSEC i potwierdzenia
  tożsamości AWS.

## 12. Koszt

Twardy limit pojedynczego pełnego benchmarku wynosi 3 USD.

GuardDuty Malware Protection for S3 ma miesięczny bezpłatny limit 1000
obiektów i 1 GB danych; korpus dwudziestu plików i maksymalnie 100 MB mieści
się w tym zakresie, o ile limit nie został wcześniej wykorzystany. Bedrock
Sonnet 4.6 jest rozliczany za tokeny wejściowe i wyjściowe. Raport zapisuje
rzeczywisty koszt każdego zadania, a runner zatrzymuje kolejne uploady przed
osiągnięciem limitu.

Nie tworzymy nowego stacka `dev`, nowego bucketa, klucza KMS ani planu
GuardDuty. Benchmark korzysta z istniejącej infrastruktury i usuwa dane
syntetyczne po zakończeniu.

## 13. Testowanie

### Testy jednostkowe

- generator zawsze tworzy dokładnie 5 teczek, 20 materiałów i co najmniej
  50 faktów;
- manifest odrzuca prawdziwie wyglądające identyfikatory i niedozwolone dane;
- scorer poprawnie liczy wartości równoważne, jednostki i konflikty;
- limit kosztu zatrzymuje następny upload;
- lista zasobów do sprzątania jest ograniczona do `run-id`;
- katalog zdarzeń produktu odrzuca dowolne nazwy i niedozwolone metadane.

### Testy integracyjne

- widok braków łączy fakty i propozycje bez duplikatów;
- historia jest tenant-scoped i uporządkowana;
- każda operacja domenowa emituje dokładnie jedno zdarzenie produktu;
- eksport oraz usunięcie konta obejmują zdarzenia produktu;
- uszkodzony i nieobsługiwany materiał kończy się kontrolowanym błędem;
- podwójne zdarzenie GuardDuty pozostaje idempotentne.

### Testy E2E

- drugi użytkownik nie widzi cudzej teczki, braków, historii ani zdarzeń;
- propozycja nie staje się faktem bez decyzji;
- pięć konfliktów jest widocznych w UI;
- pełny przebieg kończy się raportem i zerowym stanem syntetycznych danych;
- alarmy pozostają `OK`, a DLQ jest pusta.

## 14. Kryteria odbioru etapu

Etap jest gotowy, gdy:

- korpus spełnia liczby 5/20/50/5;
- Braki i Historia działają na desktopie i mobile;
- podstawowe zdarzenia M3 są zapisywane bez PII;
- benchmark lokalny przechodzi;
- produkcyjny benchmark spełnia próg 90%;
- koszt nie przekracza 3 USD;
- test izolacji zwraca 404;
- eksport i usunięcie obejmują wszystkie nowe dane;
- nie zostaje żaden syntetyczny użytkownik, rekord ani wersja S3;
- testy, lint, TypeScript, build i audyt zależności przechodzą;
- końcowy `cdk diff` nie pokazuje nieoczekiwanych zmian;
- dokumentacja COSTSEC i roadmapa pokazują rzeczywisty stan.

Po spełnieniu kryteriów fundament otrzymuje status „gotowy do M3”. Sam M3
pozostaje badaniem z prawdziwymi agentami; danych syntetycznych nie używamy do
udawania retencji, oszczędności czasu ani wartości biznesowej.

## 15. Kolejność realizacji

1. Korpus i manifest syntetyczny.
2. Scorer oraz lokalny raport benchmarku.
3. Widok Braków i konfliktów.
4. Widok Historii.
5. Instrumentacja produktu i migracja.
6. Eksport, usuwanie i test izolacji.
7. Runner produkcyjny z limitem kosztu i sprzątaniem.
8. Pełne bramy jakości.
9. Kontrolowany benchmark produkcyjny.
10. Aktualizacja roadmapy oraz COSTSEC.
