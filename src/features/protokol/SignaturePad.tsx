'use client'

import { useEffect, useRef } from 'react'

export default function SignaturePad({
  label,
  value,
  onChange,
}: {
  label: string
  value?: string
  onChange: (dataUrl: string | undefined) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height)
      img.src = value
    }
  }, [value])

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = ref.current!
    const r = c.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height] as const
  }

  return (
    <div>
      <p className="text-xs font-semibold text-foreground/60">{label}</p>
      <canvas
        ref={ref}
        width={600}
        height={200}
        aria-label={`Pole podpisu: ${label}`}
        className="mt-1 w-full touch-none rounded-lg border border-border bg-white"
        onPointerDown={(e) => {
          drawing.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          const ctx = ref.current!.getContext('2d')!
          const [x, y] = point(e)
          ctx.beginPath()
          ctx.moveTo(x, y)
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          const ctx = ref.current!.getContext('2d')!
          ctx.lineWidth = 3
          ctx.lineCap = 'round'
          ctx.strokeStyle = '#1f1a14'
          const [x, y] = point(e)
          ctx.lineTo(x, y)
          ctx.stroke()
          dirty.current = true
        }}
        onPointerUp={() => {
          drawing.current = false
          if (dirty.current) onChange(ref.current!.toDataURL('image/png'))
        }}
      />
      <button
        type="button"
        className="mt-1 text-xs font-semibold text-foreground/60 hover:text-accent"
        onClick={() => {
          dirty.current = false
          onChange(undefined)
          const c = ref.current!
          const ctx = c.getContext('2d')!
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, c.width, c.height)
        }}
      >
        Wyczyść podpis
      </button>
    </div>
  )
}
