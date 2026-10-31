import Link from 'next/link'
import { TOOL_STATUS_LABEL, type Tool } from '@/lib/tools'

export default function ToolCard({
  tool,
  index,
  hrefOverride,
}: {
  tool: Tool
  index: number
  hrefOverride?: string
}) {
  const href = hrefOverride ?? tool.href
  const external = href.startsWith('http')
  const label = TOOL_STATUS_LABEL[tool.status]
  const badge =
    tool.status === 'dziala'
      ? 'bg-accent text-white'
      : tool.status === 'pokaz'
        ? 'bg-[color:var(--slate-light)] text-foreground/70'
        : 'border border-border text-foreground/50'
  const action =
    tool.status === 'dziala'
      ? 'Otwórz'
      : tool.status === 'pokaz'
        ? 'Zobacz pokaz'
        : 'Wkrótce'
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-xs text-foreground/40">
          {String(index).padStart(2, '0')}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.1em] ${badge}`}
        >
          {label}
        </span>
      </div>
      <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-foreground">
        {tool.name}
      </h3>
      <p className="mt-1 text-sm font-semibold text-accent">{tool.lead}</p>
      <p className="mt-3 text-sm leading-6 text-foreground/60">{tool.description}</p>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="font-mono text-[0.7rem] text-foreground/45">{tool.audience}</span>
        <span className="text-sm font-semibold text-foreground">{action}</span>
      </div>
    </>
  )
  const className =
    'group block rounded-2xl border border-border bg-[color:var(--card-strong)] p-6 transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

  if (tool.status === 'wkrotce') {
    return <div className={className}>{body}</div>
  }
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    )
  }
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  )
}
