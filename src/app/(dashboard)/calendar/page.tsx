"use client";

type CalendarEvent = {
  id: number;
  date: number;
  month: string;
  day: string;
  title: string;
  time: string;
  type: "online" | "onsite";
  edition: number;
};

const events: CalendarEvent[] = [
  { id: 1, date: 22, month: "KWI", day: "ŚR", title: "Spotkanie online — przygotowanie materiałów", time: "9:00", type: "online", edition: 1 },
  { id: 2, date: 23, month: "KWI", day: "CZ", title: "Dzień 1: Twój AI Team w Akcji", time: "9:00–15:00", type: "onsite", edition: 1 },
  { id: 3, date: 24, month: "KWI", day: "PT", title: "Dzień 2: Zaawansowane AI + Automatyzacja", time: "9:00–15:00", type: "onsite", edition: 1 },
  { id: 4, date: 25, month: "KWI", day: "SO", title: "Q&A Online", time: "9:00", type: "online", edition: 1 },
];

const dayNames = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

// April 2026 starts on Wednesday (index 2), has 30 days
const aprilStartDay = 2;
const aprilDays = 30;

export default function CalendarPage() {
  const eventDates = new Map<number, CalendarEvent[]>();
  events.forEach((e) => {
    const arr = eventDates.get(e.date) || [];
    arr.push(e);
    eventDates.set(e.date, arr);
  });

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < aprilStartDay; i++) calendarCells.push(null);
  for (let d = 1; d <= aprilDays; d++) calendarCells.push(d);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
          Kalendarz
        </h2>
        <p className="text-sm text-foreground/50 mt-1">Harmonogram spotkań i sesji</p>
      </div>

      <div className="max-w-4xl">
        {/* Calendar grid */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-foreground">
              Kwiecień 2026
            </h3>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] text-foreground/40">
                <span className="w-2 h-2 rounded-full bg-accent" />
                Stacjonarnie
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-foreground/40">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Online
              </span>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {dayNames.map((name) => (
              <div key={name} className="text-center text-[10px] font-semibold text-foreground/30 uppercase tracking-wider py-2">
                {name}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7">
            {calendarCells.map((day, idx) => {
              const dayEvents = day ? eventDates.get(day) : undefined;
              return (
                <div
                  key={idx}
                  className={`relative border border-border/30 rounded-sm p-2 min-h-[72px] transition-colors ${
                    day ? "hover:bg-slate-light/50 cursor-pointer" : ""
                  } ${dayEvents ? "bg-accent/[0.04]" : ""}`}
                >
                  {day && (
                    <>
                      <span className={`text-sm tabular-nums ${dayEvents ? "font-bold text-foreground" : "text-foreground/30"}`}>
                        {day}
                      </span>
                      {dayEvents && (
                        <div className="mt-1 space-y-0.5">
                          {dayEvents.map((ev) => (
                            <div
                              key={ev.id}
                              className="text-[9px] px-1 py-0.5 truncate font-medium rounded-sm"
                              style={{
                                background: ev.type === "onsite" ? "var(--accent-light)" : "rgba(59, 130, 246, 0.08)",
                                color: ev.type === "onsite" ? "var(--accent)" : "#60a5fa",
                                borderLeft: `2px solid ${ev.type === "onsite" ? "var(--accent)" : "#60a5fa"}`,
                              }}
                            >
                              {ev.title}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Agenda cards */}
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-accent/15">
                <span className="text-accent font-bold text-xs">1</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Edycja #1</h3>
                <p className="text-[10px] text-foreground/30">22–25 kwietnia 2026</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-children">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 transition-all hover:border-accent/30"
                  style={{
                    borderLeft: `3px solid ${event.type === "onsite" ? "var(--accent)" : "#60a5fa"}`,
                  }}
                >
                  <div className="text-center flex-shrink-0 w-10">
                    <span className="text-xl font-bold text-foreground tabular-nums">{event.date}</span>
                    <span className="block text-[9px] text-foreground/30 uppercase">{event.day}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {event.title}
                    </p>
                    <p className="text-[11px] text-foreground/30 mt-0.5">{event.time}</p>
                  </div>
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md flex-shrink-0"
                    style={{
                      background: event.type === "onsite" ? "var(--accent-light)" : "rgba(59, 130, 246, 0.06)",
                      color: event.type === "onsite" ? "var(--accent)" : "#60a5fa",
                    }}
                  >
                    {event.type === "online" ? "Online" : "Na miejscu"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
