'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  endpoint: string
  /** Optional body do wysłania w POST */
  body?: Record<string, unknown>
  /** Co napis przed regeneracją */
  label?: string
  /** Co napis po wygenerowaniu - auto refresh? */
  refreshAfter?: boolean
  className?: string
}

export default function RegenerateButton({
  endpoint,
  body,
  label = 'Wygeneruj ponownie',
  refreshAfter = true,
  className = '',
}: Props) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)

  async function regenerate() {
    setRunning(true)
    setProgress(0)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.body) throw new Error('no stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let received = 0
      while (true) {
        const { value: chunk, done } = await reader.read()
        if (done) break
        received += decoder.decode(chunk).length
        setProgress(received)
      }
      if (refreshAfter) {
        // Krótki delay zeby savePersona/saveProfil zdążyło sie zapisać
        setTimeout(() => router.refresh(), 600)
      }
    } catch (e) {
      console.error('[regenerate]', e)
    } finally {
      setTimeout(() => setRunning(false), 800)
    }
  }

  return (
    <button
      onClick={regenerate}
      disabled={running}
      className={
        'inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] border transition-all ' +
        (running
          ? 'border-accent/40 text-accent bg-accent/[0.06] cursor-wait'
          : 'border-foreground/[0.12] text-foreground/60 hover:border-accent/40 hover:text-accent ') +
        className
      }
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={running ? 'animate-spin' : ''}
      >
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 4v5h-5" />
      </svg>
      {running ? `Generuję... ${Math.round(progress / 100)}` : label}
    </button>
  )
}
