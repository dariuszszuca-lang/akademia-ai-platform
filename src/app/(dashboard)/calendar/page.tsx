import Link from "next/link";
import { events, upcomingEvents, type LiveEvent } from "@/data/events";

export const dynamic = "force-dynamic";

const typeLabel: Record<LiveEvent["type"], string> = {
  online: "Online",
  stacjonarny: "Stacjonarnie",
};

const typeColor: Record<LiveEvent["type"], string> = {
  online: "var(--accent)",
  stacjonarny: "var(--muted-gold)",
};

export default function CalendarPage() {
  const upcoming = upcomingEvents();
  const past = events.filter((e) => !upcoming.includes(e));
  const next = upcoming[0];

  return (
    <div className="mx-auto max-w-4xl space-y-10 animate-fade-in-up">
      <header>
        <p className="eyebrow">Na żywo</p>
        <h1 className="display-title mt-3 text-4xl text-foreground sm:text-5xl">
          Cztery dni warsztatów, jedna agenda.
        </h1>
        {next && (
          <p className="mt-4 text-sm text-foreground/60">
            Najbliższe:{" "}
            <span className="font-semibold text-foreground">
              {next.title}
            </span>{" "}
            — {next.dateLabel}, {next.time}
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
          Nadchodzące
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-foreground/50">
            Wszystkie spotkania tej edycji za nami. Nagrania w Skarbcu.
          </p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
            Za nami
          </h2>
          <div className="space-y-2 opacity-70">
            {past.map((e) => (
              <EventRow key={e.id} event={e} past />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EventRow({ event, past = false }: { event: LiveEvent; past?: boolean }) {
  const content = (
    <div className="flex items-start gap-4 rounded-2xl border border-border bg-background/55 px-5 py-4 transition hover:border-foreground/40">
      <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-foreground/5 px-3 py-2 text-center">
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-foreground/50">
          {event.dayLabel.slice(0, 3)}
        </span>
        <span className="font-display text-2xl leading-none text-foreground">
          {event.dateLabel.split(" ")[0]}
        </span>
        <span className="text-[0.6rem] uppercase tracking-[0.16em] text-foreground/50">
          {event.dateLabel.split(" ")[1]}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="rounded-full border border-border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em]"
            style={{ color: typeColor[event.type] }}
          >
            {typeLabel[event.type]}
          </span>
          <span className="text-xs text-foreground/50">{event.time}</span>
        </div>
        <h3 className="mt-1 truncate text-sm font-semibold text-foreground">
          {event.title}
        </h3>
      </div>

      {!past && (
        <span className="shrink-0 self-center text-xs font-semibold uppercase tracking-[0.14em] text-foreground/40">
          →
        </span>
      )}
    </div>
  );

  if (event.moduleId && !past) {
    return <Link href={`/classroom/${event.moduleId}`}>{content}</Link>;
  }
  return content;
}
