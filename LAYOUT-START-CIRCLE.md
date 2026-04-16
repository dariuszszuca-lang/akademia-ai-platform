# Akademia AI Platform

## Start + Circle Layout Spec

Data: 2026-04-15

### 1. Global Shell

#### Replace Current App Frame

Zamiast:
- navbar
- sidebar
- klasyczny content area

Wprowadzić:
- top rail
- context header
- scroll sections
- optional bottom command dock

#### Top Rail

Układ:
- logo po lewej
- środek: `Start`, `Programy`, `Live`, `Vault`, `Agent`, `Circle`
- prawa strona: search, notifications, avatar

Charakter:
- wysokość 68-76px
- sticky
- półtransparentne ivory tło
- lekki blur
- bardzo subtelna dolna linia

#### Context Header

Każda sekcja ma własny hero header.

To nie jest breadcrumb ani mały page title.

To jest:
- display headline
- krótki opis
- 1 primary CTA
- 1 secondary CTA
- 1-2 metryki lub sygnały kontekstowe

---

### 2. Start Screen

### Design Role

To ma być ekran:
- wejścia
- orientacji
- priorytetyzacji
- działania

Nie ma być kolekcją widgetów.

### Proposed Structure

#### Section 1: Hero Composition

Lewa strona:
- eyebrow: `Inside Akademia AI`
- H1: `Your AI Operating Room`
- 2-liniowy opis
- CTA 1: `Kontynuuj program`
- CTA 2: `Otwórz Agenta`

Prawa strona:
- sculptural progress card
- progress programu
- najbliższy live
- status tygodnia

Ta prawa karta powinna być wizualnie bardziej premium niż zwykłe KPI boxy.

#### Section 2: What Matters Now

Trzy panele o różnych proporcjach:

**Panel A**
- najbliższy live
- data
- temat
- CTA `Dołącz`

**Panel B**
- aktywny program
- etap
- progres
- CTA `Wróć do programu`

**Panel C**
- rekomendowany materiał
- typ: replay / playbook / case study
- CTA `Otwórz`

#### Section 3: This Week

Lista tygodnia:
- poniedziałek: materiał
- środa: live
- czwartek: zadanie
- piątek: replay / podsumowanie

To może być timeline w poziomie na desktopie i pionie na mobile.

#### Section 4: Recent Unlocks

Układ editorial:
- 1 duży feature block
- 2 średnie karty
- 4 małe elementy

Typy elementów:
- nowe nagranie
- nowy playbook
- prompt pack
- case study

#### Section 5: Concierge Panel

Sekcja wyróżniona tonalnie:
- nagłówek: `Wynajmij Agenta`
- 3 przykładowe akcje
- input startowy lub button group

Przykładowe quick actions:
- `Napisz ofertę`
- `Przygotuj post i mail`
- `Zaplanuj dzień`

### Start Screen Hierarchy

Priorytety:
1. Co mam zrobić teraz
2. Co się dzieje w tym tygodniu
3. Co nowego pojawiło się w platformie
4. Jak wejść w pracę z agentem

---

### 3. Circle Screen

### Design Role

To nie ma być forum.

To ma być:
- members briefing room
- curated pulse of the platform
- miejsce wartościowych aktualizacji i rozmów

### Proposed Structure

#### Section 1: Hero Header

- eyebrow: `Circle`
- H1: `What’s Moving This Week`
- krótki opis sekcji
- CTA: `Share a Win`
- secondary CTA: `Ask The Circle`

Po prawej:
- mini pulse card
- liczba nowych wpisów
- dziś aktywni członkowie
- najbliższy live

#### Section 2: Weekly Brief

Jeden duży feature block nad całą zawartością:
- temat tygodnia
- ważne ogłoszenie
- nowy release
- notatka od prowadzącego

Układ:
- większa typografia
- duży obraz / gradient / kompozycja typograficzna
- CTA do rozwinięcia

#### Section 3: Signals

Siatka mieszana:
- 1 duży sygnał
- 2 średnie sygnały
- kilka micro updates

Rodzaje:
- wins
- nowe materiały
- nowe nagrania
- istotne komunikaty

To ma być sekcja bardziej energetyczna niż reszta.

#### Section 4: Conversations

Spokojniejsza część:
- pytania
- odpowiedzi
- wymiana doświadczeń

Każdy wpis:
- avatar
- autor
- tytuł
- 2-3 linie preview
- liczba odpowiedzi

#### Section 5: Member Pulse

Nie osobna ciężka prawa kolumna przez cały ekran.

Lepiej:
- wpleciony panel pomiędzy sekcjami
- albo lekki sticky panel tylko na bardzo szerokich ekranach

Zawartość:
- aktywni członkowie
- top wdrożenie tygodnia
- następne spotkanie
- wejście do agenta

### Filters

Zamiast generycznych kategorii:
- Briefs
- Wins
- Discussion
- New In Vault
- Announcements

### Publish Entry

Nie placeholder typu:
- `Napisz coś...`

Lepiej 3 przyciski wejściowe:
- `Share a Win`
- `Ask a Question`
- `Post an Insight`

To poprawia jakość aktywności.

---

### 4. Mobile Behaviour

#### Navigation

- top rail zwija się do compact header
- sekcje dostępne przez poziomy switcher lub sheet menu
- command dock uproszczony do 3 głównych akcji

#### Start

- hero stack
- 3 panele “What Matters Now” jako vertical cards
- timeline tygodnia w pionie

#### Circle

- weekly brief na górze
- signals jako duże karty jedna pod drugą
- conversations jako prostsza lista

Mobile ma być luksusowo prosty, nie przeładowany.

---

### 5. Suggested Component System

#### Global

- `TopRail`
- `ContextHeader`
- `CommandDock`
- `SectionTitle`

#### Start

- `HeroOperatingCard`
- `PriorityPanel`
- `WeekTimeline`
- `UnlockFeed`
- `AgentConciergePanel`

#### Circle

- `WeeklyBriefHero`
- `SignalCard`
- `MicroSignal`
- `ConversationCard`
- `MemberPulsePanel`
- `PublishActions`

---

### 6. Immediate Implementation Order

#### Phase A

- przebudować shell
- usunąć dominację lewego sidebara
- wdrożyć top rail i nowy background system

#### Phase B

- wdrożyć nowy `Start`

#### Phase C

- wdrożyć nowe `Community` jako `Circle`

#### Phase D

- przepiąć nazewnictwo i spójność reszty sekcji

---

### 7. Core Principle

Każdy ekran ma odpowiadać na jedno pytanie:

**Co najcenniejszego użytkownik ma tu zrobić teraz?**

Jeśli layout nie odpowiada jasno na to pytanie, jest zbyt dashboardowy.
