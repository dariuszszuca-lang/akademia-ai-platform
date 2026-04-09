export default function CalendarPage() {
  const events = [
    { id: 1, date: "15.04", day: "ŚR", title: "Edycja #1 — Online wstępne", time: "9:00", type: "online" },
    { id: 2, date: "16.04", day: "CZ", title: "Edycja #1 — Warsztat dzień 1", time: "9:00–15:00", type: "onsite" },
    { id: 3, date: "17.04", day: "PT", title: "Edycja #1 — Warsztat dzień 2", time: "9:00–15:00", type: "onsite" },
    { id: 4, date: "18.04", day: "SO", title: "Edycja #1 — Online Q&A", time: "9:00", type: "online" },
  ];

  return (
    <div>
      <h2 className="font-heading text-2xl font-semibold text-navy mb-2">Kalendarz</h2>
      <p className="text-gray-500 mb-8">Harmonogram warsztatów i wydarzeń</p>

      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center gap-5 hover:border-gold/30 transition-all"
          >
            <div className="w-16 h-16 rounded-lg bg-navy flex flex-col items-center justify-center text-white flex-shrink-0">
              <span className="text-xs font-medium text-gold">{event.day}</span>
              <span className="text-xl font-bold leading-tight">{event.date}</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-navy">{event.title}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{event.time}</p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                event.type === "online"
                  ? "bg-blue-50 text-blue-700"
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
