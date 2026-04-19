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
  },
];

export const visibleModules = () => modules.filter((m) => m.enabled);
