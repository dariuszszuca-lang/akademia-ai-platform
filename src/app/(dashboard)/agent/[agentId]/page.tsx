import { notFound } from "next/navigation";
import Link from "next/link";
import { getEffectiveAgents } from "@/lib/module-overrides";
import AgentWorkspace from "./AgentWorkspace";

export const dynamic = "force-dynamic";

type Props = { params: { agentId: string } };

export default async function AgentDetailPage({ params }: Props) {
  const agents = await getEffectiveAgents();
  const agent = agents.find((a) => a.id === params.agentId);
  if (!agent) notFound();

  if (!agent.enabled) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="eyebrow">Wkrótce</p>
        <h1 className="mt-4 font-display text-3xl text-foreground">
          {agent.name}
        </h1>
        <p className="mt-3 text-sm leading-6 text-foreground/60">
          Ten agent zostanie odblokowany wkrótce.
        </p>
        <Link
          href="/agent"
          className="mt-6 inline-block text-sm text-foreground/60 underline-offset-4 hover:underline"
        >
          ← Wszyscy agenci
        </Link>
      </div>
    );
  }

  return <AgentWorkspace agent={agent} />;
}
