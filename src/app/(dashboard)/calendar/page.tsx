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
  { id: 1, date: 15, month: "KWI", day: "ŚR", title: "Spotkanie online — przygotowanie materiałów", time: "9:00", type: "online", edition: 1 },
  { id: 2, date: 16, month: "KWI", day: "CZ", title: "Dzień 1: Twój AI Team w Akcji", time: "9:00–15:00", type: "onsite", edition: 1 },
  { id: 3, date: 17, month: "KWI", day: "PT", title: "Dzień 2: Zaawansowane AI + Automatyzacja", time: "9:00–15:00", type: "onsite", edition: 1 },
  { id: 4, date: 18, month: "KWI", day: "SO", title: "Q&A Online", time: "9:00", type: "online", edition: 1 },
];

const dayNames = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const aprilStartDay = 2;
const aprilDays = 30;

export default function CalendarPage() {
  const eventDates = new Map<number, CalendarEvent[]>();
  events.forEach((event) => {
    const list = eventDates.get(event.date) || [];
    list.push(event);
    eventDates.set(event.date, list);
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < aprilStartDay; i += 1) cells.push(null);
  for (let day = 1; day <= aprilDays; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <section className="premium-grid">
        <div className="section-shell rounded-[2rem] p-8 sm:p-10">
          <div className="relative z-10 max-w-2xl">
            <p className="eyebrow">Na żywo</p>
            <h1 className="display-title mt-4 text-5xl text-foreground sm:text-6xl">
              Rytm spotkań i pracy w edycji.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-foreground/66 sm:text-lg">
              Tu widać cały puls programu: przygotowanie, warsztaty, sesje Q&A i momenty,
              w których materiał przechodzi w praktyczne wdrożenie.
            </p>
          </div>
        </div>

        <aside className="section-shell rounded-[2rem] p-6 sm:p-7">
          <div className="relative z-10 space-y-4">
            <div>
              <p className="eyebrow">Najbliższy moment</p>
              <h2 className="mt-3 font-display text-3xl text-foreground">
                Dziś, 9:00
              </h2>
            </div>
            <div className="rounded-[1.5rem] border border-border bg-background/55 p-5">
              <p className="text-sm font-semibold text-foreground">Spotkanie online</p>
              <p className="mt-2 text-sm leading-6 text-foreground/58">
                Przygotowanie materiałów, zebranie pytań i ustawienie kierunku przed wejściem w warsztat.
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="section-shell rounded-[2rem] p-6 sm:p-8">
          <div className="relative z-10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="eyebrow">Kalendarz</p>
                <h2 className="mt-3 font-display text-3xl text-foreground">Kwiecień 2026</h2>
              </div>
              <div className="flex items-center gap-3 text-[0.68rem] uppercase tracking-[0.18em] text-foreground/35">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-accent" /> Na miejscu</span>
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-500" /> Online</span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center">
              {dayNames.map((name) => (
                <div key={name} className="py-2 text-[0.68rem] uppercase tracking-[0.18em] text-foreground/35">
                  {name}
                </div>
              ))}

              {cells.map((day, index) => {
                const dayEvents = day ? eventDates.get(day) : undefined;
                return (
                  <div
                    key={`${day ?? "empty"}-${index}`}
                    className={`min-h-[88px] rounded-[1rem] border p-3 text-left ${
                      day
                        ? "border-border bg-background/55"
                        : "border-transparent bg-transparent"
                    }`}
                  >
                    {day ? (
                      <>
                        <p className={`text-sm ${dayEvents ? "font-semibold text-foreground" : "text-foreground/38"}`}>
                          {day}
                        </p>
                        <div className="mt-2 space-y-1">
                          {dayEvents?.map((event) => (
                            <div
                              key={event.id}
                              className="rounded-lg px-2 py-1 text-[0.62rem] leading-4"
                              style={{
                                background: event.type === "onsite" ? "var(--accent-light)" : "rgba(59, 130, 246, 0.08)",
                                color: event.type === "onsite" ? "var(--accent)" : "#2563eb",
                              }}
                            >
                              {event.title}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="section-shell rounded-[2rem] p-6 sm:p-8">
          <div className="relative z-10">
            <p className="eyebrow">Agenda edycji</p>
            <h2 className="mt-3 font-display text-3xl text-foreground">Najbliższe wejścia.</h2>

            <div className="mt-6 space-y-4">
              {events.map((event) => (
                <div key={event.id} className="rounded-[1.5rem] border border-border bg-background/55 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--muted-gold)]">
                        {event.day} · {event.date} {event.month}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-foreground">{event.title}</h3>
                      <p className="mt-1 text-sm text-foreground/58">{event.time}</p>
                    </div>
                    <span
                      className="rounded-full px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em]"
                      style={{
                        background: event.type === "onsite" ? "var(--accent-light)" : "rgba(59, 130, 246, 0.08)",
                        color: event.type === "onsite" ? "var(--accent)" : "#2563eb",
                      }}
                    >
                      {event.type === "online" ? "Online" : "Na miejscu"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
