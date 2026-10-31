import ToolHeader from '@/components/tools/ToolHeader'
import { getTool } from '@/lib/tools'

export const metadata = { title: 'Spacer 3D z rzutu' }

export default function SpacerPage() {
  const tool = getTool('spacer-3d')!
  return (
    <div className="animate-fade-in-up space-y-6">
      <ToolHeader tool={tool} mode="platform" />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-foreground/60">
        <p>Odczyt rzutu robi AI. Zawsze porównaj model z rysunkiem przed pokazaniem klientowi.</p>
        <a href="/aplikacje/spacer-3d/index.html" target="_blank" rel="noopener" className="font-semibold text-accent hover:underline">
          Otwórz na całym ekranie
        </a>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-[color:var(--card-strong)]">
        <iframe
          src="/aplikacje/spacer-3d/index.html"
          title="Spacer 3D z rzutu"
          className="h-[78vh] w-full"
          allow="fullscreen; xr-spatial-tracking"
        />
      </div>
    </div>
  )
}
