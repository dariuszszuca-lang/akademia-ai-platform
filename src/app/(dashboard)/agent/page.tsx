import Link from "next/link";
import { type Agent } from "@/data/agents";
import { getEffectiveAgents } from "@/lib/module-overrides";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const effective = await getEffectiveAgents();
  const enabled = effective.filter((a) => a.enabled);
  const disabled = effective.filter((a) => !a.enabled);

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-in-up">
      <header>
        <p className="eyebrow">Agenci</p>
        <h1 className="display-title mt-3 text-4xl text-foreground sm:text-5xl">
          Wybierz agenta do zadania.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-foreground/60">
          Każdy agent jest wyspecjalizowany w swojej domenie — ma zestaw narzędzi do konkretnej pracy.
        </p>
      </header>

      {enabled.length > 0 && (
        <section>
          <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
            Dostępni
          </h2>
          <div className="space-y-2">
            {enabled.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      )}

      {disabled.length > 0 && (
        <section>
          <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
            Wkrótce
          </h2>
          <div className="space-y-2 opacity-50">
            {disabled.map((agent) => (
              <AgentCard key={agent.id} agent={agent} locked />
            ))}
          </div>
        </section>
      )}

      {enabled.length === 0 && disabled.length === 0 && (
        <p className="text-sm text-foreground/50">Brak agentów.</p>
      )}

      <p className="pt-6 text-xs text-foreground/40">
        Faza testów. Część narzędzi zawiera pełną treść, inne są w przygotowaniu.
      </p>
    </div>
  );
}

function AgentCard({ agent, locked = false }: { agent: Agent; locked?: boolean }) {
  const body = (
    <div className="group flex items-start gap-4 rounded-2xl border border-border bg-background/55 px-5 py-4 transition hover:border-foreground/40">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
        style={{ background: `${agent.color}18` }}
      >
        {locked ? "🔒" : agent.icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
        <p className="mt-0.5 text-xs text-foreground/55">{agent.tagline}</p>
        <p className="mt-1 text-xs text-foreground/45">
          {agent.tools.length} narzędzi
        </p>
      </div>
      {!locked && (
        <span className="shrink-0 self-center text-xs font-semibold uppercase tracking-[0.14em] text-foreground/40 transition group-hover:text-foreground">
          Wejdź →
        </span>
      )}
    </div>
  );

  if (locked) return body;
  return <Link href={`/agent/${agent.id}`}>{body}</Link>;
}
