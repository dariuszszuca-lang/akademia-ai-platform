export type LiveEvent = {
  id: string;
  date: string;
  dateLabel: string;
  dayLabel: string;
  title: string;
  time: string;
  type: "online" | "stacjonarny";
  zoomLink?: string;
  moduleId?: string;
};

export const events: LiveEvent[] = [
  {
    id: "d1",
    date: "2026-04-22",
    dateLabel: "22 kwietnia",
    dayLabel: "środa",
    title: "Spotkanie online — otwarcie warsztatów",
    time: "9:00",
    type: "online",
    moduleId: "dzien-1-online",
  },
  {
    id: "d2",
    date: "2026-04-23",
    dateLabel: "23 kwietnia",
    dayLabel: "czwartek",
    title: "Dzień 2 — Warsztat stacjonarny (podstawy)",
    time: "9:00–15:00",
    type: "stacjonarny",
    moduleId: "dzien-2-stacjonarny",
  },
  {
    id: "d3",
    date: "2026-04-24",
    dateLabel: "24 kwietnia",
    dayLabel: "piątek",
    title: "Dzień 3 — Warsztat stacjonarny (zaawansowany)",
    time: "9:00–15:00",
    type: "stacjonarny",
    moduleId: "dzien-3-zaawansowany",
  },
  {
    id: "d4",
    date: "2026-04-25",
    dateLabel: "25 kwietnia",
    dayLabel: "sobota",
    title: "Dzień 4 — Q&A online i domknięcie",
    time: "10:00",
    type: "online",
    moduleId: "dzien-4-qa-online",
  },
];

export function upcomingEvents(now: Date = new Date()): LiveEvent[] {
  const today = now.toISOString().slice(0, 10);
  return events.filter((e) => e.date >= today);
}
