"use client";

import Link from "next/link";
import { useState } from "react";
import type { Agent, AgentTool } from "@/data/agents";

type LegalSource = {
  id: string;
  ustawa: string;
  art: string;
  ksiega?: string;
  url?: string;
  score?: number;
};

const META_OPEN = "[[META]]";
const META_CLOSE = "[[/META]]\n";

export default function AgentWorkspace({ agent }: { agent: Agent }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [goal, setGoal] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [sources, setSources] = useState<LegalSource[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const selected = agent.tools.find((t) => t.id === selectedId);

  function selectTool(id: string) {
    setSelectedId(id);
    setContext("");
    setGoal("");
    setOutput(null);
    setSources([]);
    setCopied(false);
  }

  function resetSelection() {
    setSelectedId(null);
    setOutput(null);
    setSources([]);
  }

  function parseStreamChunk(raw: string): { meta: LegalSource[] | null; content: string } {
    // Stream może zaczynać się od [[META]]{json}[[/META]]\n
    if (raw.startsWith(META_OPEN)) {
      const closeIdx = raw.indexOf(META_CLOSE);
      if (closeIdx > 0) {
        const json = raw.slice(META_OPEN.length, closeIdx);
        try {
          const parsed = JSON.parse(json) as { sources: LegalSource[] };
          return { meta: parsed.sources ?? [], content: raw.slice(closeIdx + META_CLOSE.length) };
        } catch {
          return { meta: [], content: raw };
        }
      }
    }
    return { meta: null, content: raw };
  }

  async function run() {
    if (!selected) return;
    setRunning(true);
    setOutput("");
    setSources([]);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          toolId: selected.id,
          context,
          goal,
        }),
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      let metaProcessed = false;
      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        raw += decoder.decode(chunk);
        if (!metaProcessed && raw.includes(META_CLOSE)) {
          const parsed = parseStreamChunk(raw);
          if (parsed.meta) {
            setSources(parsed.meta);
            raw = parsed.content;
            metaProcessed = true;
          } else {
            metaProcessed = true;
          }
        } else if (!metaProcessed && !raw.startsWith(META_OPEN.slice(0, Math.min(raw.length, META_OPEN.length)))) {
          // raw definitely doesn't start with META, no meta in this stream
          metaProcessed = true;
        }
        setOutput(raw);
      }
    } catch (e) {
      setOutput(
        (prev) =>
          (prev ?? "") +
          `\n\n[Błąd: ${e instanceof Error ? e.message : "unknown"}]`,
      );
    } finally {
      setRunning(false);
    }
  }

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-in-up">
      <div className="flex items-center gap-2 text-xs text-foreground/50">
        <Link href="/agent" className="hover:text-foreground">
          Agenci
        </Link>
        <span>·</span>
        <span>{agent.name}</span>
      </div>

      <header>
        <div className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
            style={{ background: `${agent.color}18`, border: `1px solid ${agent.color}30` }}
          >
            {agent.icon}
          </span>
          <div>
            <p className="eyebrow" style={{ color: agent.color }}>
              Agent
            </p>
            <h1 className="mt-1 display-title text-foreground" style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}>
              {agent.name}
            </h1>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-foreground/65 max-w-2xl">{agent.description}</p>
      </header>

      {!selected ? (
        <section>
          <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
            Narzędzia
          </h2>
          <div className="space-y-2">
            {agent.tools.map((tool) => (
              <ToolRow key={tool.id} tool={tool} onClick={() => selectTool(tool.id)} color={agent.color} />
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="flex items-start gap-3 rounded-2xl border border-border bg-[color:var(--card)] p-5">
            <button
              onClick={resetSelection}
              className="shrink-0 text-xs text-foreground/50 hover:text-foreground"
            >
              ← Zmień
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-foreground/45">
                Narzędzie
              </p>
              <h2 className="mt-1 text-base font-semibold text-foreground">{selected.title}</h2>
              <p className="mt-1 text-xs text-foreground/55">{selected.description}</p>
              <p className="mt-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: agent.color }}>
                Wynik: {selected.result}
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <label className="mb-2 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-foreground/50">
                Kontekst
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder={selected.placeholders.context}
                rows={3}
                className="w-full rounded-2xl border border-border bg-background/55 px-4 py-3 text-sm text-foreground placeholder:text-foreground/30 focus:border-foreground/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-foreground/50">
                Cel
              </label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={selected.placeholders.goal}
                rows={2}
                className="w-full rounded-2xl border border-border bg-background/55 px-4 py-3 text-sm text-foreground placeholder:text-foreground/30 focus:border-foreground/40 focus:outline-none"
              />
            </div>
            <button
              onClick={run}
              disabled={running}
              className="w-full rounded-2xl px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
              style={{ background: running ? "var(--fg)" : agent.color }}
            >
              {running ? "Pracuję..." : `Uruchom ${agent.name}`}
            </button>
          </section>

          {output && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
                  {running ? "Generuję..." : "Wynik"}
                  {running && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
                </h2>
                <button
                  onClick={copyOutput}
                  className="text-xs font-semibold text-foreground/60 hover:text-foreground"
                >
                  {copied ? "Skopiowano ✓" : "Kopiuj"}
                </button>
              </div>

              {sources.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-foreground/40">
                    Źródła:
                  </span>
                  {sources.map((s) => (
                    <a
                      key={s.id}
                      href={s.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-accent border border-accent/30 bg-accent/[0.06] hover:bg-accent/[0.12] hover:border-accent/50 transition-colors"
                      title={`${s.ustawa}${s.ksiega ? ' · ' + s.ksiega : ''}`}
                    >
                      art. {s.art} {s.ustawa === "Kodeks cywilny" ? "KC" : s.ustawa}
                    </a>
                  ))}
                </div>
              )}

              <pre className="whitespace-pre-wrap rounded-2xl glass-card p-6 text-sm leading-6 text-foreground" style={{ fontFamily: 'inherit' }}>
                {output}
              </pre>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ToolRow({
  tool,
  onClick,
  color,
}: {
  tool: AgentTool;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-2xl border border-border bg-background/55 p-5 text-left transition hover:border-foreground/40"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{tool.title}</h3>
          <p className="mt-1 text-xs leading-5 text-foreground/55">{tool.description}</p>
          <p
            className="mt-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em]"
            style={{ color }}
          >
            {tool.result}
          </p>
        </div>
        <span className="shrink-0 self-center text-sm font-semibold text-foreground/40 transition group-hover:text-foreground">
          →
        </span>
      </div>
    </button>
  );
}
