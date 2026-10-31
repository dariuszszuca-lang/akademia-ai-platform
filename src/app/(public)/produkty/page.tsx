import ToolCard from '@/components/tools/ToolCard'
import { PLATFORM_NAME } from '@/lib/product'
import { TOOLS } from '@/lib/tools'

export const metadata = {
  title: `Narzędzia do mieszkania · ${PLATFORM_NAME}`,
  description:
    'Rejestr cen transakcyjnych, protokół zdawczo-odbiorczy z telefonu, księga wieczysta po ludzku, umowa najmu okazjonalnego i spacer 3D z rzutu.',
}

export default function PublicProductsPage() {
  const tools = TOOLS.filter((tool) => tool.standaloneHref)
  return (
    <div className="space-y-8 pt-6">
      <header>
        <p className="eyebrow">Narzędzia</p>
        <h1 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.2rem)] font-bold leading-tight tracking-[-0.03em] text-foreground">
          Narzędzia do mieszkania. Działają bez konta.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-foreground/60">
          Z kontem wyniki zapisujesz w teczce mieszkania i masz wszystko w jednym miejscu.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {tools.map((tool, index) => (
          <ToolCard key={tool.id} tool={tool} index={index + 1} hrefOverride={tool.standaloneHref} />
        ))}
      </div>
    </div>
  )
}
