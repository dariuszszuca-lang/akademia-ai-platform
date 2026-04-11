export default function CalendarPage() {
  const events = [
    { id: 1, date: "15", month: "KWI", day: "ŚR", title: "Edycja #1 — Online wstępne", time: "9:00", type: "online" },
    { id: 2, date: "16", month: "KWI", day: "CZ", title: "Edycja #1 — Warsztat dzień 1", time: "9:00–15:00", type: "onsite" },
    { id: 3, date: "17", month: "KWI", day: "PT", title: "Edycja #1 — Warsztat dzień 2", time: "9:00–15:00", type: "onsite" },
    { id: 4, date: "18", month: "KWI", day: "SO", title: "Edycja #1 — Online Q&A", time: "9:00", type: "online" },
    { id: 5, date: "22", month: "KWI", day: "ŚR", title: "Edycja #2 — Online wstępne", time: "9:00", type: "online" },
    { id: 6, date: "23", month: "KWI", day: "CZ", title: "Edycja #2 — Warsztat dzień 1", time: "9:00–15:00", type: "onsite" },
    { id: 7, date: "24", month: "KWI", day: "PT", title: "Edycja #2 — Warsztat dzień 2", time: "9:00–15:00", type: "onsite" },
    { id: 8, date: "25", month: "KWI", day: "SO", title: "Edycja #2 — Online Q&A", time: "9:00", type: "online" },
  ];

  // Group by edition
  const edition1 = events.filter((e) => e.id <= 4);
  const edition2 = events.filter((e) => e.id > 4);

  const renderEvent = (event: typeof events[0], isLast: boolean) => (
    <div
      key={event.id}
      className="flex gap-5 group cursor-pointer"
    >
      {/* Date column with timeline */}
      <div className="flex flex-col items-center w-16 flex-shrink-0">
        <div className="bg-card rounded-xl border border-border p-2 text-center w-full group-hover:border-gold/30 transition-colors">
          <span className="text-[9px] font-semibold text-foreground/30 uppercase tracking-wider block">{event.month}</span>
          <span className="text-2xl font-bold text-foreground leading-tight block tabular-nums">{event.date}</span>
          <span className="text-[10px] text-foreground/30 block">{event.day}</span>
        </div>
        {/* Timeline connector */}
        {!isLast && (
          <div className="w-px flex-1 bg-border my-1" />
        )}
      </div>

      {/* Event card */}
      <div className="flex-1 bg-card rounded-2xl border border-border p-5 mb-3 card-hover group-hover:border-gold/20 transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-foreground group-hover:text-gold-dark transition-colors">
              {event.title}
            </h3>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5 text-foreground/35">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-xs">{event.time}</span>
              </div>
            </div>
          </div>
          <span
            className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 ${
              event.type === "online"
                ? "bg-blue-500/8 text-blue-500 dark:text-blue-400"
                : "bg-gold/8 text-gold-dark"
            }`}
          >
            {event.type === "online" ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                Stacjonarnie
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-heading text-2xl font-semibold text-foreground tracking-wide">Kalendarz warsztatów</h2>
        <p className="text-sm text-foreground/40 mt-1">Harmonogram spotkań i sesji</p>
      </div>

      {/* Edition 1 */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center">
            <span className="text-white font-bold text-xs">1</span>
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Edycja #1</h3>
            <p className="text-[11px] text-foreground/30">15–18 kwietnia 2026</p>
          </div>
        </div>
        <div className="stagger-children">
          {edition1.map((event, i) => renderEvent(event, i === edition1.length - 1))}
        </div>
      </div>

      {/* Edition 2 */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-navy to-navy-light flex items-center justify-center">
            <span className="text-gold font-bold text-xs">2</span>
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Edycja #2</h3>
            <p className="text-[11px] text-foreground/30">22–25 kwietnia 2026</p>
          </div>
        </div>
        <div className="stagger-children">
          {edition2.map((event, i) => renderEvent(event, i === edition2.length - 1))}
        </div>
      </div>
    </div>
  );
}
