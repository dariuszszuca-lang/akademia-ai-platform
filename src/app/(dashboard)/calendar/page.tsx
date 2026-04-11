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
  { id: 1, date: 15, month: "KWI", day: "ŚR", title: "Online wstępne", time: "9:00", type: "online", edition: 1 },
  { id: 2, date: 16, month: "KWI", day: "CZ", title: "Warsztat dzień 1", time: "9:00–15:00", type: "onsite", edition: 1 },
  { id: 3, date: 17, month: "KWI", day: "PT", title: "Warsztat dzień 2", time: "9:00–15:00", type: "onsite", edition: 1 },
  { id: 4, date: 18, month: "KWI", day: "SO", title: "Online Q&A", time: "9:00", type: "online", edition: 1 },
  { id: 5, date: 22, month: "KWI", day: "ŚR", title: "Online wstępne", time: "9:00", type: "online", edition: 2 },
  { id: 6, date: 23, month: "KWI", day: "CZ", title: "Warsztat dzień 1", time: "9:00–15:00", type: "onsite", edition: 2 },
  { id: 7, date: 24, month: "KWI", day: "PT", title: "Warsztat dzień 2", time: "9:00–15:00", type: "onsite", edition: 2 },
  { id: 8, date: 25, month: "KWI", day: "SO", title: "Online Q&A", time: "9:00", type: "online", edition: 2 },
];

const dayNames = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

// April 2026 starts on Wednesday (index 2), has 30 days
const aprilStartDay = 2; // 0=Monday
const aprilDays = 30;

export default function CalendarPage() {
  const eventDates = new Map<number, CalendarEvent[]>();
  events.forEach((e) => {
    const arr = eventDates.get(e.date) || [];
    arr.push(e);
    eventDates.set(e.date, arr);
  });

  // Build calendar grid
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < aprilStartDay; i++) calendarCells.push(null);
  for (let d = 1; d <= aprilDays; d++) calendarCells.push(d);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  // Group events by week for agenda below
  const week1Events = events.filter((e) => e.date >= 15 && e.date <= 18);
  const week2Events = events.filter((e) => e.date >= 22 && e.date <= 25);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <h2 className="font-heading text-4xl font-bold text-foreground tracking-wide gold-glow-text">
          Kalendarz
        </h2>
        <p className="text-sm text-foreground/35 mt-2 font-light tracking-wide">Harmonogram spotkań i sesji</p>
        <div className="w-24 h-px bg-gradient-to-r from-gold to-transparent mt-4" />
      </div>

      <div className="max-w-4xl">
        {/* Calendar grid */}
        <div className="bg-card border border-border p-6 mb-10" style={{ borderRadius: "0" }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-heading text-lg font-semibold text-foreground tracking-wider">
              Kwiecień 2026
            </h3>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] text-foreground/30">
                <span className="w-2 h-2" style={{ background: "rgba(201, 160, 48, 0.4)" }} />
                Stacjonarnie
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-foreground/30">
                <span className="w-2 h-2" style={{ background: "rgba(59, 130, 246, 0.4)" }} />
                Online
              </span>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {dayNames.map((name) => (
              <div key={name} className="text-center text-[10px] font-semibold text-foreground/25 uppercase tracking-wider py-2">
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
                  className={`relative border border-border/30 p-2 min-h-[72px] transition-colors ${
                    day ? "hover:bg-slate-light/50 cursor-pointer" : ""
                  } ${dayEvents ? "bg-gold/[0.03]" : ""}`}
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
                              className="text-[9px] px-1 py-0.5 truncate font-medium"
                              style={{
                                background: ev.type === "onsite" ? "rgba(201, 160, 48, 0.1)" : "rgba(59, 130, 246, 0.08)",
                                color: ev.type === "onsite" ? "#C9A030" : "#60a5fa",
                                borderLeft: `2px solid ${ev.type === "onsite" ? "#C9A030" : "#60a5fa"}`,
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

        {/* Agenda cards grouped by week */}
        <div className="space-y-8">
          {/* Week 1 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 flex items-center justify-center" style={{ background: "rgba(201, 160, 48, 0.15)" }}>
                <span className="text-gold font-bold text-xs">1</span>
              </div>
              <div>
                <h3 className="font-heading text-sm font-semibold text-foreground tracking-wider uppercase">Edycja #1</h3>
                <p className="text-[10px] text-foreground/25">15–18 kwietnia 2026</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 stagger-children">
              {week1Events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-4 bg-card border border-border p-4 transition-all hover:border-gold/20"
                  style={{
                    borderLeft: `3px solid ${event.type === "onsite" ? "#C9A030" : "#60a5fa"}`,
                    borderRadius: "0",
                  }}
                >
                  <div className="text-center flex-shrink-0 w-10">
                    <span className="text-xl font-bold text-foreground tabular-nums">{event.date}</span>
                    <span className="block text-[9px] text-foreground/25 uppercase">{event.day}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {event.title}
                    </p>
                    <p className="text-[11px] text-foreground/30 mt-0.5">{event.time}</p>
                  </div>
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider px-2 py-1 flex-shrink-0"
                    style={{
                      background: event.type === "onsite" ? "rgba(201, 160, 48, 0.08)" : "rgba(59, 130, 246, 0.06)",
                      color: event.type === "onsite" ? "#C9A030" : "#60a5fa",
                    }}
                  >
                    {event.type === "online" ? "Online" : "Na miejscu"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Week 2 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 flex items-center justify-center" style={{ background: "rgba(59, 130, 246, 0.1)" }}>
                <span className="text-blue-400 font-bold text-xs">2</span>
              </div>
              <div>
                <h3 className="font-heading text-sm font-semibold text-foreground tracking-wider uppercase">Edycja #2</h3>
                <p className="text-[10px] text-foreground/25">22–25 kwietnia 2026</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 stagger-children">
              {week2Events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-4 bg-card border border-border p-4 transition-all hover:border-gold/20"
                  style={{
                    borderLeft: `3px solid ${event.type === "onsite" ? "#C9A030" : "#60a5fa"}`,
                    borderRadius: "0",
                  }}
                >
                  <div className="text-center flex-shrink-0 w-10">
                    <span className="text-xl font-bold text-foreground tabular-nums">{event.date}</span>
                    <span className="block text-[9px] text-foreground/25 uppercase">{event.day}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {event.title}
                    </p>
                    <p className="text-[11px] text-foreground/30 mt-0.5">{event.time}</p>
                  </div>
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider px-2 py-1 flex-shrink-0"
                    style={{
                      background: event.type === "onsite" ? "rgba(201, 160, 48, 0.08)" : "rgba(59, 130, 246, 0.06)",
                      color: event.type === "onsite" ? "#C9A030" : "#60a5fa",
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
