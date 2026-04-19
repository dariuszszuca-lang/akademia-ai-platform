export type LessonFile = {
  name: string;
  url: string;
  size?: number;
  mime?: string;
};

export type Lesson = {
  id: string;
  title: string;
  type: "tekst" | "video" | "zadanie";
  content: string;
  files?: LessonFile[];
  duration?: number;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  progress: number;
  accentColor: string;
  icon: string;
  lessons: number;
  category: "Start" | "Warsztaty" | "Skarbiec" | "Narzędzia" | "Zewnętrzne";
  enabled: boolean;
  locked?: boolean;
  external?: string;
  image?: string;
  meta?: string;
  items?: Lesson[];
};

export const modules: Course[] = [
  {
    id: "start",
    title: "Start tutaj",
    description: "Powitanie, orientacja i pierwszy rytm pracy wewnątrz platformy.",
    progress: 0,
    accentColor: "#576150",
    icon: "00",
    lessons: 3,
    category: "Start",
    enabled: true,
    items: [
      {
        id: "witaj",
        title: "Witaj w Akademii AI",
        type: "tekst",
        duration: 5,
        content: `# Witaj w Akademii AI

To jest Twoje środowisko pracy z AI — nie tylko biblioteka kursów. Tutaj uczysz się, wracasz po materiały, spotykasz innych uczestników i pracujesz z agentem.

## Jak zorganizowana jest platforma

**Warsztaty** — serce Akademii. Cztery dni pracy nad Twoim AI Team:
1. Spotkanie online (otwieramy)
2. Warsztat stacjonarny — podstawy
3. Warsztat stacjonarny — zaawansowany
4. Q&A online (domykamy)

**Skarbiec** — wszystko do czego wracasz po warsztatach: playbooki, checklisty, narzędzia, replaye.

**Na żywo** — harmonogram najbliższych spotkań.

**Agent** — Twój osobisty asystent AI do codziennej pracy.

**Społeczność i Ludzie** — miejsce na rozmowy i networking z innymi uczestnikami.

## Co dalej

Przejdź do modułu **Przygotowanie przed warsztatem** i zrób 6 zadań zanim spotkamy się online. Każde zajmie Ci 5-15 minut.`,
      },
      {
        id: "jak-pracujemy",
        title: "Jak pracujemy podczas warsztatów",
        type: "tekst",
        duration: 4,
        content: `# Jak pracujemy

**Filozofia:** output first. Nie uczysz się żeby wiedzieć — uczysz się żeby robić.

## Format

- **Krótkie inputy** (10-15 min) — pokazuję jak
- **Długie robienie** (30-45 min) — Ty robisz, ja pomagam
- **Check-in** (5 min) — co się udało, co zablokowało
- **Powtarzamy**

## Zasady

1. **Nie notuj** — wszystko masz w Akademii (nagrania, transkrypty, playbooki)
2. **Pytaj od razu** — zatrzymanie na 2 min oszczędza godzinę w domu
3. **Kończ zadanie** — wychodzisz z warsztatu z gotowym outputem, nie z pomysłem
4. **Wróć do materiałów** — po warsztatach Skarbiec jest Twoim drugim mózgiem`,
      },
      {
        id: "zanim-zaczniesz",
        title: "Zanim zaczniesz — co sprawdzić",
        type: "zadanie",
        duration: 10,
        content: `# Zanim zaczniesz

Sprawdź że masz wszystko przygotowane.

## Konta

- [ ] **Claude** (claude.ai) — konto Pro (20 USD/mies) albo wersja darmowa z ograniczeniami
- [ ] **ChatGPT** (chat.openai.com) — konto Plus albo wersja darmowa
- [ ] **Notion** (notion.so) — konto darmowe wystarczy na start
- [ ] **Canva** (canva.com) — wersja Pro polecana, darmowa też działa

## Narzędzia lokalne (instalujemy na Dzień 2)

- [ ] **Google Chrome** najnowszy
- [ ] **Visual Studio Code** (code.visualstudio.com) — instalujemy na warsztacie
- [ ] **Terminal macOS / Windows Terminal** — domyślny w systemie

## Sprzęt

- Laptop z co najmniej 8 GB RAM
- Zasilacz (pracujemy 6-8h)
- Myszka (opcjonalnie, ale wygodniej)
- Słuchawki na spotkanie online

Nie masz czegoś? Napisz — podpowiem co zainstalować i jak.`,
      },
    ],
  },
  {
    id: "przygotowanie",
    title: "Przygotowanie przed warsztatem",
    description: "Profil przedsiębiorcy, persony, oferta, konfiguracja kont AI i pobranie asystentów.",
    progress: 0,
    accentColor: "#b28a52",
    icon: "0",
    lessons: 6,
    category: "Start",
    enabled: true,
    items: [
      {
        id: "profil",
        title: "Zbuduj swój profil przedsiębiorcy",
        type: "zadanie",
        duration: 15,
        content: `# Profil przedsiębiorcy

Zanim wrzucimy AI w Twój biznes, AI musi wiedzieć **kim jesteś i co robisz**. Ten dokument będziesz podawać Claude/ChatGPT za każdym razem — albo zrobimy z niego stały kontekst na warsztatach.

## Pobierz szablon i wypełnij

Otwórz plik poniżej i wypełnij każdą sekcję. Bez lania wody — krótko i konkretnie.

## Sekcje do wypełnienia

1. **Kim jesteś** — imię, rola, biuro, specjalizacja (1-2 zdania)
2. **Twoi klienci** — kto do Ciebie dzwoni, co ich boli, czego szukają
3. **Twoje produkty** — co sprzedajesz, jakie masz oferty, ceny
4. **Twój ton głosu** — czy piszesz formalnie, luźno, ekspercko?
5. **Co Cię wyróżnia** — dlaczego ktoś ma wybrać Ciebie

## Dlaczego to ważne

AI bez kontekstu daje generyczne odpowiedzi które pasują do każdego. AI z Twoim profilem daje odpowiedzi **dla Ciebie** — Twoim tonem, z Twoją ofertą, do Twojego klienta.

## Czas: 15 minut

Daj sobie 15 minut. Nie szukaj perfekcji — lepiej mieć wersję 80% która działa, niż 100% w głowie.`,
        files: [
          { name: "profil-szablon.md", url: "/materialy/profil-szablon.md" },
        ],
      },
      {
        id: "persona",
        title: "Opisz swoją personę klienta",
        type: "zadanie",
        duration: 15,
        content: `# Persona klienta

Kto dokładnie jest Twoim klientem? Im konkretniej, tym lepszy output z AI.

## Wypełnij kartę persony

**Demografia:** wiek, płeć, miejsce zamieszkania, stan rodzinny
**Sytuacja:** co robi zawodowo, jaki ma budżet, jakie ma ograniczenia czasowe
**Problem:** co go boli, czego szuka, co próbował wcześniej
**Emocje:** co czuje gdy przychodzi do Ciebie — strach, niepewność, zmęczenie?
**Cel:** co chce osiągnąć, jak wygląda sukces z jego perspektywy

Treść szczegółowa w przygotowaniu — pełny szablon dostaniesz na warsztacie.`,
      },
      {
        id: "oferta",
        title: "Spisz swoją ofertę",
        type: "zadanie",
        duration: 10,
        content: `# Oferta

Co konkretnie sprzedajesz? Treść w przygotowaniu.`,
      },
      {
        id: "konta-ai",
        title: "Skonfiguruj konta AI",
        type: "zadanie",
        duration: 20,
        content: `# Konta AI

Claude, ChatGPT, Notion, Canva — co założyć, jak skonfigurować. Treść w przygotowaniu.`,
      },
      {
        id: "asystenci",
        title: "Pobierz asystentów startowych",
        type: "zadanie",
        duration: 10,
        content: `# Asystenci startowi

Gotowe Projekty Claude i Custom GPT które wrzucisz na swoje konto. Treść w przygotowaniu.`,
      },
      {
        id: "check",
        title: "Check-in przed warsztatem",
        type: "zadanie",
        duration: 5,
        content: `# Check-in

Ostatnie sprawdzenie — czy masz wszystko na warsztat. Treść w przygotowaniu.`,
      },
    ],
  },
  {
    id: "dzien-1-online",
    title: "Dzień 1 — Spotkanie online",
    description: "Otwarcie warsztatów, agenda, zapoznanie z platformą i przygotowanie do dni stacjonarnych.",
    progress: 0,
    accentColor: "#1e4e53",
    icon: "1",
    lessons: 1,
    category: "Warsztaty",
    enabled: true,
    meta: "Zoom — link zostanie dodany",
    items: [
      {
        id: "spotkanie",
        title: "Spotkanie online — agenda i wejście do Zooma",
        type: "video",
        duration: 60,
        content: `# Spotkanie online

**Data:** zostanie uzupełniona
**Czas trwania:** 60 minut
**Link Zoom:** _zostanie uzupełniony_

## Agenda

1. Powitanie i przedstawienie się (10 min)
2. Jak będziemy pracować na warsztacie (10 min)
3. Przegląd przygotowanych materiałów — pytania (20 min)
4. Ostatnie sprawdzenie sprzętu i kont (10 min)
5. Q&A otwarte (10 min)

## Co przygotować przed spotkaniem

- Wypełniony profil przedsiębiorcy (moduł Przygotowanie)
- Listę pytań które Cię blokują
- Kawę. Będzie intensywnie.`,
      },
    ],
  },
  {
    id: "dzien-2-stacjonarny",
    title: "Dzień 2 — Warsztat stacjonarny (podstawy)",
    description: "Konfiguracja, styl pisania, wideo, posty, narzędzia agenta i plan działania.",
    progress: 0,
    accentColor: "#b96d5d",
    icon: "2",
    lessons: 7,
    category: "Warsztaty",
    enabled: false,
    items: [
      { id: "d2-1", title: "Powitanie i ustawienie dnia", type: "tekst", duration: 15, content: "Treść w przygotowaniu." },
      { id: "d2-2", title: "Konfiguracja AI Team na Twoim koncie", type: "zadanie", duration: 45, content: "Treść w przygotowaniu." },
      { id: "d2-3", title: "Twój styl pisania w AI", type: "zadanie", duration: 45, content: "Treść w przygotowaniu." },
      { id: "d2-4", title: "Generowanie postów i opisów", type: "zadanie", duration: 60, content: "Treść w przygotowaniu." },
      { id: "d2-5", title: "Wideo i rolki z AI", type: "zadanie", duration: 60, content: "Treść w przygotowaniu." },
      { id: "d2-6", title: "Plan działania na następny tydzień", type: "zadanie", duration: 30, content: "Treść w przygotowaniu." },
      { id: "d2-7", title: "Domknięcie dnia i zadanie na wieczór", type: "tekst", duration: 10, content: "Treść w przygotowaniu." },
    ],
  },
  {
    id: "dzien-3-zaawansowany",
    title: "Dzień 3 — Warsztat stacjonarny (zaawansowany)",
    description: "Instalacja lokalna, skille, API, MCP, automatyzacje, integracje i certyfikacja.",
    progress: 0,
    accentColor: "#7c5d99",
    icon: "3",
    lessons: 7,
    category: "Warsztaty",
    enabled: false,
    items: [
      { id: "d3-1", title: "Powitanie i przegląd pracy domowej", type: "tekst", duration: 15, content: "Treść w przygotowaniu." },
      { id: "d3-2", title: "Instalacja Claude Code lokalnie", type: "zadanie", duration: 45, content: "Treść w przygotowaniu." },
      { id: "d3-3", title: "Skille i slash commands", type: "zadanie", duration: 60, content: "Treść w przygotowaniu." },
      { id: "d3-4", title: "API i integracje", type: "zadanie", duration: 60, content: "Treść w przygotowaniu." },
      { id: "d3-5", title: "MCP — podłączanie zewnętrznych narzędzi", type: "zadanie", duration: 60, content: "Treść w przygotowaniu." },
      { id: "d3-6", title: "Twój pierwszy workflow end-to-end", type: "zadanie", duration: 60, content: "Treść w przygotowaniu." },
      { id: "d3-7", title: "Certyfikacja i plan 30 dni", type: "tekst", duration: 20, content: "Treść w przygotowaniu." },
    ],
  },
  {
    id: "dzien-4-qa-online",
    title: "Dzień 4 — Q&A online",
    description: "Sesja pytań i odpowiedzi po warsztatach plus archiwum nagrań.",
    progress: 0,
    accentColor: "#8d6170",
    icon: "4",
    lessons: 1,
    category: "Warsztaty",
    enabled: false,
    meta: "Zoom — link zostanie dodany",
    items: [
      {
        id: "qa",
        title: "Sesja Q&A i domknięcie",
        type: "video",
        duration: 60,
        content: `# Q&A online

Sesja pytań i odpowiedzi po warsztatach stacjonarnych.

**Link Zoom:** _zostanie uzupełniony_
**Czas trwania:** 60 minut

Przynieś pytania które pojawiły się kiedy zaczęłaś wdrażać po warsztacie. Nagranie trafia do Skarbca.`,
      },
    ],
  },
];

export const visibleModules = () => modules.filter((m) => m.enabled);

export function findModule(id: string): Course | undefined {
  return modules.find((m) => m.id === id);
}

export function findLesson(moduleId: string, lessonId: string): Lesson | undefined {
  return findModule(moduleId)?.items?.find((l) => l.id === lessonId);
}

export function firstLessonOfModule(moduleId: string): Lesson | undefined {
  return findModule(moduleId)?.items?.[0];
}
