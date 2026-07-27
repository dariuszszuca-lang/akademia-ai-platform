# Property Intelligence Studio — kontrolowana przebudowa produktu

Data: 2026-07-27  
Status: zatwierdzony kierunek, specyfikacja do odbioru przed planem wdrożenia  
Właściciel biznesowy: Wojtek Lisiecki, Keller Williams, Poznań  
Właściciel produktu: Darek  
Właściciel techniczny: CTO

## 1. Decyzja

Platforma przestaje być Akademią AI i produktem edukacyjno-społecznościowym.
Staje się w całości `Property Intelligence Studio`: systemem operacyjnym pracy
agenta wokół konkretnej nieruchomości.

Wdrażamy kontrolowaną przebudowę istniejącej aplikacji. Usuwamy stare moduły,
routing, treści i branding, ale zachowujemy działającą infrastrukturę,
uwierzytelnianie, dane użytkowników, bazę, administrację oraz zbudowany już
Property Truth Engine.

## 2. Cel

Po wdrożeniu użytkownik ma widzieć jeden spójny produkt dla agentów
nieruchomości. Każda główna funkcja ma prowadzić do pracy na teczce
nieruchomości albo wykorzystywać jej zatwierdzone dane.

Główna obietnica:

> Z surowych danych nieruchomości do wiarygodnej oferty i kompletnego planu
> sprzedaży — bez przepisywania informacji i bez halucynacji AI.

Zasada produktu:

> Najpierw fakty. Potem kreacja.

## 3. Zakres usunięcia

Z produktu usuwamy:

- Classroom i lekcje,
- Programy i Warsztaty,
- Społeczność,
- Ludzi i listę członków,
- Skarbiec materiałów,
- Kalendarz,
- wydarzenia na żywo,
- strony „O Akademii” i inne treści edukacyjne,
- dane demonstracyjne i szybkie akcje prowadzące do usuniętych modułów,
- API obsługujące wyłącznie usunięte funkcje,
- widoczne nazwy, opisy, metadane, linki i komunikaty Akademii AI.

Stare adresy użytkowe nie będą prowadzić do martwych ekranów. Otrzymają
kontrolowane przekierowanie do pulpitu albo do najbliższego odpowiednika
produktowego.

## 4. Zakres zachowania

Zachowujemy:

- Cognito i obecny przepływ logowania,
- konta oraz identyfikatory użytkowników,
- profile agentów i persony klientów,
- onboarding branżowy,
- teczki nieruchomości, fakty, statusy i historię zmian,
- bazę PostgreSQL i migracje Property Truth Engine,
- panel administratora,
- mechanizmy eksportu i usuwania danych,
- rozliczenia i integrację Stripe,
- istniejący design system oraz kierunek wizualny Studio,
- wdrożenie Vercel i pozostałą infrastrukturę techniczną.

Wewnętrzne nazwy istniejących zasobów AWS, Stripe, Pinecone i bazy mogą
tymczasowo zawierać historyczne określenia. Nie są częścią interfejsu produktu.
Ich zmiana nie wchodzi do tego wdrożenia, ponieważ wymaga osobnej migracji
infrastruktury i mogłaby naruszyć dostęp do danych lub logowanie.

## 5. Docelowa architektura informacji

### 5.1. Pulpit

Adres: `/start`

Pulpit pokazuje:

- ostatnio używane nieruchomości,
- teczki wymagające uzupełnienia,
- liczbę braków i konfliktów,
- bieżący etap pracy nad ofertami,
- następne działania,
- skrót do utworzenia nowej nieruchomości.

Nie pokazuje kursów, wydarzeń, materiałów szkoleniowych ani aktywności
społeczności.

### 5.2. Portfolio

Adres: `/nieruchomosci`

Portfolio pozostaje głównym katalogiem teczek. Użytkownik może utworzyć
mieszkanie, dom, działkę, lokal, obiekt komercyjny albo inną nieruchomość.

### 5.3. Teczka nieruchomości

Adres: `/nieruchomosci/[propertyId]`

Teczka jest centralnym obiektem produktu. Docelowe obszary:

- Przegląd,
- Fakty,
- Źródła,
- Braki,
- Materiały,
- Historia.

Następne moduły, takie jak Plot Future Lab, Offer Launch Lab i Buyer Room,
będą uruchamiane z poziomu teczki i będą korzystać z jej zatwierdzonych faktów.

### 5.4. Zespół AI

Adres bazowy: `/agent`

Dotychczasowi asystenci zostają przeformułowani jako zespół narzędzi Studio.
Tam, gdzie zadanie dotyczy oferty, użytkownik wybiera teczkę, a agent otrzymuje
jej zatwierdzone dane. Narzędzia nie mogą samodzielnie zmieniać statusu faktu
na potwierdzony ani publikować materiału.

### 5.5. Profil i ustawienia

Adresy: `/profil`, `/settings`

Pozostają miejscem zarządzania profilem zawodowym, danymi konta, eksportem,
usunięciem konta i rozliczeniami.

## 6. Docelowa nawigacja

Główna nawigacja:

1. Pulpit,
2. Portfolio,
3. Zespół AI,
4. Profil.

Ustawienia i wylogowanie pozostają w menu konta. Command palette korzysta z
tej samej mapy i nie zawiera skrótów do usuniętych modułów.

Na urządzeniach mobilnych kolejność oraz nazwy są takie same. Nie tworzymy
osobnej mobilnej architektury informacji.

## 7. Mapa starych adresów

| Stary adres | Zachowanie po przebudowie |
|---|---|
| `/classroom` i podstrony | przekierowanie do `/start` |
| `/programy` i podstrony | przekierowanie do `/start` |
| `/community`, `/spolecznosc` | przekierowanie do `/start` |
| `/ludzie`, `/members` | przekierowanie do `/start` |
| `/skarbiec` | przekierowanie do `/start` |
| `/calendar`, `/na-zywo` | przekierowanie do `/start` |
| `/about`, `/o-akademii` | przekierowanie do `/start` |

Przekierowania pozostają jako małe pliki zgodności. Implementacje dawnych
ekranów, dane demonstracyjne i obsługujące je komponenty zostają usunięte.

## 8. Branding i język

W każdym miejscu widocznym dla użytkownika stosujemy nazwę
`Property Intelligence Studio`.

Zmiana obejmuje:

- metadane strony,
- logowanie i rejestrację,
- onboarding,
- nagłówki i nawigację,
- command palette,
- panel administratora,
- nazwy eksportowanych plików,
- plany i komunikaty płatności,
- prompty systemowe agentów,
- domyślne adresy aplikacji w komunikatach i linkach.

Nie używamy określeń sugerujących kurs, akademię, warsztat lub społeczność,
jeżeli nie opisują one rzeczywistej funkcji Studio.

## 9. Dane i przepływy

### 9.1. Logowanie

Użytkownik loguje się przez obecne Cognito. Po utworzeniu sesji trafia na
`/start`. Przebudowa nie zmienia identyfikatora użytkownika ani istniejących
powiązań danych.

### 9.2. Onboarding

Onboarding buduje profil zawodowy agenta i persony jego klientów. Jego wynik
jest używany przez Zespół AI oraz przyszłe moduły marketingowe Studio.

### 9.3. Praca z nieruchomością

Przepływ podstawowy:

1. utworzenie teczki,
2. dodanie i sklasyfikowanie faktów,
3. wykrycie braków i konfliktów,
4. zatwierdzenie danych przez człowieka,
5. uruchomienie modułu wykonawczego na zatwierdzonych danych,
6. zapis rezultatu i historii decyzji.

### 9.4. Dane historyczne Akademii

Nie wykonujemy automatycznego kasowania rekordów użytkowników ani danych konta.
Kod i dane funkcji edukacyjnych usuwamy tylko wtedy, gdy są jednoznacznie
oddzielone od profilu, płatności i danych Studio. Destrukcyjne czyszczenie
zewnętrznych magazynów lub rekordów produkcyjnych wymaga osobnego planu,
backupów i potwierdzenia.

## 10. Obsługa błędów

- Chronione ekrany bez sesji przekierowują do `/login`.
- Nieistniejąca lub cudza teczka zwraca bezpieczne `404`.
- Stare adresy produktowe przekierowują do `/start`.
- Awaria danych na pulpicie nie może odsłonić danych innego użytkownika.
- Brak konfiguracji integracji kończy się czytelnym stanem niedostępności, nie
  pustym ekranem.
- Usuwane elementy nie pozostawiają odnośników, które prowadzą do błędu.

## 11. Kolejność wdrożenia

1. Zbudować nową mapę marki i nawigacji.
2. Przebudować `/start` na pulpit Studio.
3. Zmienić branding ekranów uwierzytelniania, onboardingu i administracji.
4. Oczyścić Zespół AI z kontekstu Akademii.
5. Usunąć stare moduły, komponenty, dane i dedykowane API.
6. Dodać przekierowania ze starych adresów.
7. Oczyścić eksporty, rozliczenia, metadane i teksty techniczne widoczne dla
   użytkownika.
8. Przeprowadzić pełną weryfikację i wdrożenie produkcyjne.

## 12. Testowanie

Wymagane testy automatyczne:

- główna nawigacja zawiera wyłącznie docelowe pozycje,
- stare ścieżki przekierowują do `/start`,
- pulpit pobiera wyłącznie teczki zalogowanego użytkownika,
- logowanie nadal tworzy prawidłową sesję,
- nieprawidłowy token nadal jest odrzucany,
- eksport danych zawiera dane Studio,
- usunięcie konta obejmuje dane Studio,
- wyszukiwanie repozytorium nie znajduje widocznego brandingu Akademii.

Weryfikacja przed wdrożeniem:

- testy jednostkowe i integracyjne,
- TypeScript,
- lint,
- build produkcyjny,
- przegląd zmian i nieużywanych importów,
- smoke test logowania,
- smoke test pulpitu i Portfolio,
- smoke test utworzenia oraz otwarcia teczki,
- sprawdzenie starych przekierowań,
- kontrola mobile i podstawowej dostępności.

## 13. Kryteria odbioru

Przebudowa jest zakończona, gdy:

- użytkownik nie widzi nazwy ani funkcji Akademii AI,
- główna nawigacja składa się z Pulpitu, Portfolio, Zespołu AI i Profilu,
- stare moduły edukacyjne i społecznościowe nie są dostępne,
- stare adresy nie kończą się błędem,
- istniejące konta oraz teczki nadal działają,
- Property Intelligence Studio jest jedyną nazwą produktu w interfejsie,
- testy, lint, TypeScript i build przechodzą,
- główny adres produkcyjny wskazuje zweryfikowany deployment.

## 14. Poza zakresem

To wdrożenie nie obejmuje:

- zmiany dostawcy uwierzytelniania,
- migracji kont Cognito,
- zmiany nazw istniejących zasobów chmurowych,
- automatycznego kasowania danych produkcyjnych,
- budowy kompletnego Plot Future Lab,
- budowy kompletnego Offer Launch Lab,
- budowy Buyer Room,
- automatycznej publikacji ofert, reklam lub postów,
- zmiany zatwierdzonego kierunku wizualnego Studio.
