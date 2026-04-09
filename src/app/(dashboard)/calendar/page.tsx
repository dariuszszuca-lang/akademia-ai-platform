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

  return (
    <div className="max-w-4xl">
      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-white rounded-xl border border-border p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="w-14 h-14 rounded-xl bg-slate-light flex flex-col items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-semibold text-gray-400 uppercase">{event.month}</span>
              <span className="text-xl font-bold text-navy leading-tight">{event.date}</span>
              <span className="text-[10px] text-gray-400">{event.day}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-navy">{event.title}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{event.time}</p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                event.type === "online"
                  ? "bg-blue-50 text-blue-600"
                  : "bg-gold/10 text-gold-dark"
              }`}
            >
              {event.type === "online" ? "Online" : "Stacjonarnie"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
