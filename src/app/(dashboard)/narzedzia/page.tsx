import ToolCard from '@/components/tools/ToolCard'
import { TOOLS } from '@/lib/tools'

export const metadata = { title: 'Narzędzia' }

export default function ToolsPage() {
  return (
    <div className="animate-fade-in-up space-y-8">
      <header>
        <p className="eyebrow">Narzędzia</p>
        <h1 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.2rem)] font-bold leading-tight tracking-[-0.03em] text-foreground">
          Wszystko do mieszkania w jednym miejscu.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-foreground/60">
          Każde narzędzie działa też osobno, bez konta. Na platformie wyniki zapisujesz w teczce mieszkania.
        </p>
      </header>
      <div className="stagger-children grid gap-4 md:grid-cols-2">
        {TOOLS.map((tool, index) => (
          <ToolCard key={tool.id} tool={tool} index={index + 1} />
        ))}
      </div>
    </div>
  )
}
