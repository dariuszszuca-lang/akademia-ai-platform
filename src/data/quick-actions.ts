export type QuickAction = {
  id: string;
  name: string;
  note: string;
  href: string;
  emoji: string;
  tone: string;
};

export const defaultQuickActions: QuickAction[] = [
  {
    id: "agent",
    name: "Agent",
    note: "Uruchom zadanie",
    href: "/agent",
    emoji: "✨",
    tone: "from-[color:var(--accent)] to-[color:var(--aqua)]",
  },
  {
    id: "tydzien",
    name: "Tydzień",
    note: "Najbliższe live",
    href: "/na-zywo",
    emoji: "📅",
    tone: "from-[color:var(--muted-gold)] to-[color:var(--copper)]",
  },
  {
    id: "warsztat",
    name: "Warsztat",
    note: "Wróć do ścieżki",
    href: "/programy",
    emoji: "🔖",
    tone: "from-[color:var(--rose)] to-[color:var(--plum)]",
  },
];

export const toneOptions = [
  { label: "Morski / złoto", value: "from-[color:var(--accent)] to-[color:var(--aqua)]" },
  { label: "Złoto / miedź", value: "from-[color:var(--muted-gold)] to-[color:var(--copper)]" },
  { label: "Róż / śliwka", value: "from-[color:var(--rose)] to-[color:var(--plum)]" },
  { label: "Oliwka / zieleń", value: "from-[color:var(--olive)] to-[color:var(--accent)]" },
  { label: "Miedź / róż", value: "from-[color:var(--copper)] to-[color:var(--rose)]" },
];
