type Props = {
  current: number
  total: number
  sectionLabel?: string
}

export default function ProgressBar({ current, total, sectionLabel }: Props) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="w-full">
      <div className="flex justify-between items-baseline text-[11px] uppercase tracking-[0.25em] text-foreground/40 mb-2">
        <span>{sectionLabel ?? ''}</span>
        <span className="font-medium text-foreground/60">
          {current} / {total}
        </span>
      </div>
      <div className="h-px bg-foreground/[0.08] relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-accent transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
