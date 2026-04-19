import type { Course } from "./modules";

export const resources: Course[] = [
  {
    id: "rct",
    title: "Rejestr cen transakcyjnych",
    description: "Darmowy dostęp do rzeczywistych cen nieruchomości z aktów notarialnych.",
    progress: 0,
    accentColor: "#8d6170",
    icon: "R",
    lessons: 0,
    external: "https://rejestrcentransakcyjnych.pl",
    category: "Zewnętrzne",
    enabled: true,
  },
  {
    id: "biblioteka",
    title: "Skarbiec zasobów",
    description: "Prompty, checklisty, poradniki, szablony i playbooki do wykorzystania w pracy.",
    progress: 0,
    accentColor: "#3b7d78",
    icon: "S",
    lessons: 11,
    category: "Skarbiec",
    enabled: true,
  },
  {
    id: "narzedzia",
    title: "Narzędzia AI",
    description: "Claude, Gemini, NotebookLM, Lovable i Claude Code z przykładami użycia.",
    progress: 0,
    accentColor: "#5d7a62",
    icon: "N",
    lessons: 5,
    category: "Narzędzia",
    enabled: true,
  },
  {
    id: "nagrania-qa",
    title: "Archiwum Q&A",
    description: "Sesje Q&A z sobót i odpowiedzi na pytania pojawiające się po warsztatach.",
    progress: 0,
    accentColor: "#7c5d99",
    icon: "Q",
    lessons: 1,
    category: "Skarbiec",
    enabled: true,
  },
];

export const visibleResources = () => resources.filter((r) => r.enabled);
