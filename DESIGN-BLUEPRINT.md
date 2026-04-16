# Akademia AI Platform

## Premium Design Blueprint

Data: 2026-04-15

### 1. Strategic Repositioning

Platforma nie powinna wyglądać jak kolejny LMS ani community SaaS.

Nie komunikujemy:
- kursy
- moduły
- funkcje
- dashboard

Komunikujemy:
- prywatny klub wdrożeniowy AI
- operacyjny system rozwoju
- concierge dla przedsiębiorców i agentów
- miejsce, gdzie wiedza, live, społeczność i agent pracują razem

Najlepsza rama dla produktu:

**AI Members Club + Execution Studio**

To daje premium, ekskluzywność i praktyczne poczucie wartości. Użytkownik ma czuć, że wszedł do prywatnego środowiska pracy, nie do tablicy z lekcjami.

---

### 2. Information Architecture

Obecna logika:
- community
- classroom
- calendar
- members
- about

To jest czytelne technicznie, ale nie jest aspiracyjne. Wygląda jak standardowy produkt SaaS.

Nowa logika powinna być oparta o intencję użytkownika.

#### Primary Navigation

- Start
- Programy
- Live
- Vault
- Agent
- Circle

#### Meaning Of Each Section

**Start**
- główna strona operacyjna
- jedna rekomendacja na dziś
- postęp w aktywnym programie
- najbliższy live
- ostatnio odblokowane materiały
- szybkie wejście do agenta

**Programy**
- zamiast klasycznego classroom
- programy jako ścieżki transformacji
- przykładowo: Warsztaty, Certyfikacja, Sprinty, Biblioteka wdrożeń
- każdy program ma własny hero, progres i moduły

**Live**
- kalendarz warsztatów i spotkań
- replays
- agendy
- materiały przygotowawcze
- CTA do rezerwacji miejsca lub wejścia na spotkanie

**Vault**
- zamiast “materiały” lub “biblioteka”
- archiwum premium
- nagrania
- prompty
- checklisty
- playbooki
- case studies
- szablony do wdrożenia

**Agent**
- wynajem agenta AI
- gotowe workflowy i akcje
- panel concierge
- miejsce, w którym user odpala realne zadania

**Circle**
- zamiast generycznego forum
- curated social layer
- ogłoszenia
- wins
- praktyczne dyskusje
- insighty od zespołu

---

### 3. Structural Principle

Nie używamy lewego sidebara jako głównego wzorca.

Zamiast tego:
- cienki top navigation bar
- duży hero-operating layer pod nawigacją
- sekcje układane wertykalnie jak editorial product
- command dock lub quick actions przy dolnej krawędzi na desktopie
- contextual panels tylko tam, gdzie mają sens

To daje:
- mniej “aplikacja do zarządzania”
- więcej “premium operacyjna przestrzeń”

#### Navigation Model

**Top Rail**
- logo
- główne sekcje
- wyszukiwarka
- avatar
- wejście do agenta

**Context Header**
- duży nagłówek zależny od sekcji
- podsumowanie wartości
- 1 główne CTA
- 2 pomocnicze wskaźniki

**Command Dock**
- szybkie akcje
- otwórz ostatni materiał
- wejdź na live
- zadaj zadanie agentowi
- sprawdź plan tygodnia

Dock powinien przypominać bardziej luksusowe studio narzędzi niż pasek utility.

---

### 4. Visual Direction

#### Design Goal

Ma być:
- premium
- spokojnie luksusowe
- nowoczesne
- czytelne
- odróżniające się od Skool, Circle, Kajabi i standardowych LMS-ów

Nie ma być:
- ciemne cyber-AI
- fioletowe SaaS
- sterylne białe dashboardy
- “startup tool”

#### Palette

Proponowany kierunek:
- Ink: `#131614`
- Ivory: `#F3EFE7`
- Smoke: `#D9D2C3`
- Olive: `#576150`
- Deep Teal: `#1E4E53`
- Muted Gold: `#B28A52`
- Rose Clay Accent: `#B96D5D`

Zasada:
- tło jasne, ciepłe, nie czysto białe
- sekcje na tonalnych powierzchniach
- akcenty oszczędne, ale szlachetne

#### Typography

Najlepszy efekt da zestaw:
- serif lub high-contrast display do hero i sekcji premium
- neutralny grotesk do treści i elementów systemowych

Przykładowy klimat:
- nagłówki: Canela / Editorial-style / Fraunces / Cormorant-like direction
- UI i body: Geist / Sohne-like / grotesk neutralny

Zasada:
- większe, spokojniejsze nagłówki
- mniej kapitalików
- więcej redakcyjnego rytmu

#### Surfaces

- karty nie powinny wyglądać jak standardowe cards z Tailwinda
- używać dużych promieni, miękkich obramowań i tonalnych przejść
- mniej siatki małych pudełek
- więcej dużych paneli z mocną hierarchią

#### Motion

- wolniejsze, bardziej luksusowe przejścia
- slide + fade
- delikatne reveal przy wejściu sekcji
- unikać “microinteraction overload”

#### Background Language

- subtelne gradienty
- delikatna tekstura papieru / canvas
- czasem miękkie geometryczne plamy tła
- bez płaskiego #fff i bez generycznego dark mode

---

### 5. Home Screen: Start

To powinien być najważniejszy ekran całej platformy.

Nie lista modułów. Nie feed. Nie dashboard z widżetami.

To ma być:

**Today’s Operating Room**

#### Suggested Layout

**Section A: Hero**
- duży nagłówek typu:
  `Your AI Practice Room`
  albo
  `This Week Inside The Club`
- krótki opis
- CTA `Continue Program`
- secondary CTA `Open Agent`
- po prawej: elegancki progress composition zamiast zwykłego progressbara

**Section B: What Matters Now**
- trzy duże karty:
  - następny live
  - aktywny program
  - rekomendowany materiał

**Section C: This Week**
- agenda tygodnia
- 3-5 pozycji
- live, replay, zadanie, materiał, call to action

**Section D: Recent Unlocks**
- nowo dodane nagrania, playbooki, case studies
- układ bardziej editorial niż grid produktowy

**Section E: Concierge**
- panel wejścia do wynajmu agenta
- opis 2-3 przykładowych akcji
- pole do startu zadania

#### Why This Works

User od razu widzi:
- co teraz zrobić
- gdzie jest wartość
- co jest nowe
- że ta platforma żyje

---

### 6. Community Screen: Circle

Obecny układ feed + prawa kolumna jest zbyt standardowy.

Ta sekcja powinna działać jak:

**Editorial Intelligence Room**

#### Suggested Layout

**Section A: Weekly Brief**
- jeden duży feature panel
- temat tygodnia
- pinned announcement lub strategiczna wiadomość
- zdjęcie, grafika lub typograficzny hero block

**Section B: Signals**
- krótsze aktualizacje
- wins
- ogłoszenia
- nowe materiały
- nowe nagrania

Zamiast identycznych kart:
- różne rozmiary bloków
- 1 duży
- 2 średnie
- kilka mikro-update tiles

**Section C: Conversations**
- prawdziwe dyskusje userów
- bardziej kameralne, mniejszy kontrast wizualny niż w signals
- pytania i odpowiedzi

**Section D: Member Pulse**
- panel boczny lub wpleciony panel kontekstowy
- kto jest aktywny
- następne spotkanie
- top wdrożenie tygodnia
- szybkie wejście do agenta

#### Filters

Filtry powinny być bardziej redakcyjne niż techniczne:
- Briefs
- Wins
- Discussions
- New In Vault
- Announcements

#### Publishing Entry

Nie “Napisz coś...”.

Lepiej:
- `Share a Win`
- `Ask The Circle`
- `Post an Insight`

To buduje wyższy poziom rozmowy.

---

### 7. Programs Screen

Nie klasyczna lista kursów.

Lepiej:
- sezonowe, duże karty programów
- każda z własnym tonem i opisem efektu
- status: now / upcoming / completed

Każdy program:
- hero
- outcomes
- roadmap
- moduły
- bonus assets
- powiązane live

To powinno bardziej przypominać premium studio curriculum niż szkolny LMS.

---

### 8. Vault Screen

Vault ma wyglądać jak prywatne archiwum wiedzy.

#### Structure

- Featured Collection
- New Releases
- Playbooks
- Replays
- Prompt Library
- Case Studies

#### Browsing

- filtr po typie i wyniku
- nie tylko kategorie, ale też “co chcesz osiągnąć”
- przykład:
  - zdobyć leady
  - automatyzować proces
  - publikować content
  - pracować z agentem AI

To przesuwa platformę z biblioteki plików do biblioteki rezultatów.

---

### 9. Agent Screen

To może być najbardziej wyróżniająca sekcja całego produktu.

Nie czat jako główne doświadczenie.

Lepiej:
- katalog gotowych akcji
- duże utility cards
- każda akcja opisana wynikiem

Przykłady:
- Opracuj Ofertę
- Napisz Post i Mail
- Przygotuj Się Do Spotkania
- Zbuduj Plan Dnia
- Oceń Materiał Sprzedażowy

Użytkownik klika zadanie, a dopiero potem wchodzi w workflow.

To jest dużo bardziej produktowe i premium niż pusty chat box.

---

### 10. UI System Rules

#### Avoid

- stały lewy sidebar
- małe ciasne cards
- zbyt wiele ramek
- generyczne ikony i badge
- domyślne dashboard spacing patterns
- feed jako główna metafora produktu

#### Use

- duże sekcje z mocnym rytmem
- editorial layout
- asymetria kontrolowana
- duże typograficzne wejścia
- karty o różnych skalach
- kontekstowe quick actions

---

### 11. Recommended Build Sequence

#### Step 1

Przebudować globalny shell:
- usunąć dominację sidebara
- dodać top rail
- dodać context header
- zdefiniować premium tokens kolorów i typografii

#### Step 2

Przebudować `Start`:
- jeden ekran operacyjny
- tygodniowy rytm
- wejście do programów, live i agenta

#### Step 3

Przebudować `Community` jako `Circle`:
- weekly brief
- signals
- conversations
- member pulse

#### Step 4

Przebudować `Classroom` na `Programy` oraz `Materials` na `Vault`

#### Step 5

Dodać `Agent` jako wyróżnik produktu

---

### 12. Positioning Sentence

Jeśli cały design ma trzymać jedną linię, to powinien odpowiadać temu zdaniu:

**Akademia AI to prywatna przestrzeń, w której uczysz się, wdrażasz i uruchamiasz realną pracę z AI w jednym premium środowisku.**
