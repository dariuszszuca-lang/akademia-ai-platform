import Link from 'next/link'
import { TOOL_STATUS_LABEL, type Tool } from '@/lib/tools'

export default function ToolHeader({
  tool,
  mode,
}: {
  tool: Tool
  mode: 'platform' | 'public'
}) {
  const standaloneExternal = tool.standaloneHref?.startsWith('http')
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="eyebrow">{mode === 'platform' ? 'Narzędzie' : 'Narzędzie bez logowania'}</p>
        <h1 className="mt-2 font-display text-[clamp(1.9rem,4vw,2.8rem)] font-bold leading-tight tracking-tight text-foreground">
          {tool.name}
        </h1>
        <p className="mt-1 text-sm font-semibold text-accent">{tool.lead}</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/60">{tool.description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-md bg-accent px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-white">
          {TOOL_STATUS_LABEL[tool.status]}
        </span>
        {mode === 'platform' ? (
          <>
            {tool.standaloneHref && (
              <a
                href={tool.standaloneHref}
                target={standaloneExternal ? '_blank' : undefined}
                rel={standaloneExternal ? 'noopener noreferrer' : undefined}
                className="font-semibold text-foreground/70 hover:text-accent"
              >
                Osobna strona
              </a>
            )}
            <Link href="/narzedzia" className="font-semibold text-foreground hover:text-accent">
              Wszystkie narzędzia
            </Link>
          </>
        ) : null}
      </div>
    </header>
  )
}
