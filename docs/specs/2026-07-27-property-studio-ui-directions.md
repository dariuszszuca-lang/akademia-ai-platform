# Property Intelligence Studio — trzy kierunki UI

Data: 2026-07-27  
Status: do wyboru przed implementacją nowych ekranów  
Zakres: portfolio, teczka nieruchomości, paszport faktów i kolejne moduły Studio

## Wspólne zasady

Niezależnie od wybranego kierunku:

- najważniejszym obiektem ekranu jest nieruchomość, nie agent AI,
- status informacji ma etykietę i ikonę, nie tylko kolor,
- użytkownik zawsze widzi, czy pracuje na danych wewnętrznych, klienckich czy
  publicznych,
- na mobile najpierw pokazujemy stan, braki i główne działanie,
- na desktopie można zestawić źródło i wynik obok siebie,
- wszystkie akcje mają czytelny stan ładowania, powodzenia i błędu,
- formularze mają widoczne etykiety i walidację przy polu,
- minimalny cel dotykowy ma 44 × 44 px,
- klawiatura pozwala wykonać cały podstawowy przepływ,
- animacje służą pokazaniu zmiany stanu i trwają 150–300 ms,
- interfejs respektuje `prefers-reduced-motion`,
- żadna wizualizacja AI nie jest pokazana bez oznaczenia.

## Kierunek A — Trust Studio

Rekomendacja CTO.

### Paleta

- tło ciemne: `#0D171B`,
- powierzchnia ciemna: `#15252A`,
- powierzchnia jasna: `#FFFDF8`,
- tekst na jasnym: `#162026`,
- tekst na ciemnym: `#F7F2E7`,
- główny teal: `#2D6B68`,
- akcent piaskowy: `#BD9360`,
- semantyczne statusy: stonowany zielony, bursztynowy, czerwony i niebieski.

### Typografia

- nagłówki: Fraunces,
- UI i tekst: Geist Sans,
- identyfikatory, daty i dane tabelaryczne: Geist Mono.

Wszystkie trzy kroje są już zgodne z obecnym kierunkiem platformy.

### Layout

- ciemna, stała rama aplikacji,
- jasny workspace teczki nieruchomości,
- boczna nawigacja na desktopie,
- pasek kontekstu z nazwą nieruchomości i stanem procesu,
- zakładki: Przegląd, Fakty, Źródła, Braki, Materiały, Historia,
- split view w miejscach, gdzie agent porównuje źródło z faktem,
- jedna wyraźna akcja główna na ekran.

### Mood i odniesienie

Prywatne studio pracy połączone z redakcyjną precyzją. Spokojne, rzeczowe,
premium. Ciemna rama buduje charakter produktu, a jasne powierzchnie ułatwiają
pracę z dokumentami i dłuższym tekstem.

### Zalety

- zachowuje ciągłość z obecną „Czarną porcelaną”,
- buduje odróżnialną markę,
- nie wygląda jak typowy CRM,
- pozwala połączyć efekt premium z czytelnością dokumentów,
- dobrze pasuje do warstwy zaufania i kontroli AI.

### Ryzyko

Trzeba pilnować kontrastu na ciemnych powierzchniach i ograniczyć szkło,
gradienty oraz dekoracyjne animacje. Workspace nie może być ciemny wszędzie,
bo dłuższa praca z dokumentem stałaby się męcząca.

## Kierunek B — Evidence Desk

### Paleta

- papier: `#FDFBF7`,
- powierzchnia: `#FFFFFF`,
- atrament: `#1A2429`,
- szarość tekstu: `#4D5D62`,
- teal: `#0F766E`,
- granice: `#DDE2DF`,
- ostrzeżenie: `#A76718`.

### Typografia

- nagłówki i cytaty ze źródeł: Newsreader albo Source Serif 4,
- UI i tekst: Geist Sans,
- metadane: Geist Mono.

### Layout

- jasny, dokumentowy interfejs,
- pionowa lista nieruchomości,
- na ekranie faktu dwa panele: źródło po lewej, wartość i status po prawej,
- mało kart i cieni,
- hierarchię tworzą linie, odstępy i typografia,
- historia zmian przypomina redakcyjne poprawki dokumentu.

### Mood i odniesienie

Biurko analityka, redakcja dokumentu, spokojna praca z dowodami. Interfejs ma
wyglądać jak miejsce, w którym sprawdza się informacje, a nie jak narzędzie do
generowania treści.

### Zalety

- najwyższa czytelność dokumentów i faktów,
- naturalnie komunikuje wiarygodność,
- prostszy technicznie,
- bardzo dobry do wydruku i raportów,
- małe ryzyko wizualnego starzenia.

### Ryzyko

Sam kierunek może wyglądać zbyt zachowawczo i słabiej pokazywać technologiczny
charakter produktu. Trzeba dodać wyrazisty sposób prezentacji Future Lab.

## Kierunek C — Precision Command

### Paleta

- tło: `#F8FAFC`,
- powierzchnia: `#FFFFFF`,
- granat: `#0F172A`,
- profesjonalny niebieski: `#0369A1`,
- teal statusu: `#0F766E`,
- neutralne granice: `#E2E8F0`,
- statusy: zielony, bursztynowy i czerwony o wysokim kontraście.

### Typografia

- wszystkie elementy: Geist Sans,
- dane, wersje i identyfikatory: Geist Mono.

### Layout

- klasyczny dashboard operacyjny,
- lewy sidebar,
- górny pasek filtrów i wyszukiwarki,
- zwarte tabele,
- duże liczniki braków, konfliktów i teczek gotowych,
- szybkie akcje dostępne bez otwierania szczegółu,
- drill-down od portfolio do pojedynczego faktu.

### Mood i odniesienie

Panel operacyjny dla zespołu, który prowadzi wiele ofert naraz. Nacisk na
szybkość skanowania, statusy i zarządzanie pracą.

### Zalety

- najwyższa efektywność przy większej liczbie nieruchomości,
- znane wzorce dla użytkowników CRM,
- dobre przygotowanie pod zespoły i raportowanie,
- łatwo pokazać problemy wymagające reakcji.

### Ryzyko

Może przypominać wiele istniejących systemów SaaS i CRM. Daje mniej emocji oraz
słabszy efekt „tego nie ma nigdzie indziej”. Przy małej liczbie ofert wygląda
zbyt technicznie.

## Rekomendacja

Wybrać Kierunek A — Trust Studio.

Powód: produkt powinien jednocześnie odróżniać się od CRM i budzić zaufanie
podczas pracy z faktami. Ciemna rama tworzy charakter, a jasny workspace
zapewnia czytelność znaną z Kierunku B. Nie kopiujemy jednak wszystkich cech
obu wariantów. Kierunek A pozostaje jednym spójnym systemem.

## Decyzja

Przed rozpoczęciem kodowania należy zapisać jeden wybór:

- `A — Trust Studio`,
- `B — Evidence Desk`,
- `C — Precision Command`.

