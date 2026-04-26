'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type ProposedType = {
  name: string
  who: string
  problem: string
  match: string
}

type Props = {
  type: 'buyer' | 'seller'
  resultPath: string
}

export default function PersonaPathA({ type, resultPath }: Props) {
  const router = useRouter()
  const [types, setTypes] = useState<ProposedType[] | null>(null)
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chosenIdx, setChosenIdx] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genStream, setGenStream] = useState('')

  useEffect(() => {
    fetch('/api/onboarding/persona/types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'AI nie odpowiedziało')
        if (!data.types || data.types.length !== 3) {
          throw new Error('AI zwrócił nieprawidłowy format (oczekiwano 3 typy)')
        }
        setTypes(data.types)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'unknown'))
      .finally(() => setLoadingTypes(false))
  }, [type])

  async function expand(idx: number) {
    if (!types) return
    setChosenIdx(idx)
    setGenerating(true)
    setGenStream('')

    try {
      const res = await fetch('/api/onboarding/persona/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          chosenType: types[idx],
          chosenIndex: idx + 1,
        }),
      })
      if (!res.body) throw new Error('no stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { value: chunk, done } = await reader.read()
        if (done) break
        setGenStream(prev => prev + decoder.decode(chunk))
      }
      setTimeout(() => router.push(resultPath), 1500)
    } catch (err) {
      setGenStream(s => s + `\n\n[Błąd: ${err instanceof Error ? err.message : 'unknown'}]`)
    }
  }

  const isBuyer = type === 'buyer'

  if (loadingTypes) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-4 animate-fade-in-up">
        <div className="text-[11px] uppercase tracking-[0.3em] text-accent">
          AI analizuje Twój profil
        </div>
        <h1 className="text-foreground text-2xl font-medium">
          Generuję 3 typy klientów {isBuyer ? 'kupujących' : 'sprzedających'} dla Twojego rynku.
        </h1>
        <p className="text-foreground/40 text-sm">Chwila...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-16 space-y-4 animate-fade-in-up">
        <div className="p-5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200">
          <div className="font-medium mb-1">Coś poszło nie tak</div>
          <p className="text-sm">{error}</p>
        </div>
        <button
          onClick={() => location.reload()}
          className="px-5 py-2 bg-accent text-white rounded-full text-sm hover:bg-accent/90"
        >
          Spróbuj ponownie
        </button>
      </div>
    )
  }

  if (generating) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-8 animate-fade-in-up">
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.3em] text-accent">
            AI rozwija typ do pełnej persony
          </div>
          <h1 className="text-foreground text-2xl font-medium">
            {chosenIdx !== null && types && types[chosenIdx].name}
          </h1>
        </div>
        <div className="bg-foreground/[0.02] border border-foreground/[0.08] rounded-xl p-6 min-h-[260px]">
          <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-foreground/85">
            {genStream || (
              <span className="text-foreground/30">
                <span className="inline-block w-2 h-3.5 bg-accent/60 animate-pulse align-middle" />
              </span>
            )}
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 sm:py-16 space-y-10 animate-fade-in-up">
      <div className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.3em] text-accent">
          Persona {isBuyer ? 'kupującego' : 'sprzedającego'} · 3 propozycje AI
        </div>
        <h1 className="text-foreground text-2xl sm:text-3xl font-medium tracking-tight">
          Który typ klienta najbardziej pasuje do Ciebie?
        </h1>
        <p className="text-foreground/50 text-sm leading-relaxed">
          Wybierz jeden. AI rozwinie go do pełnej persony.
        </p>
      </div>

      <div className="space-y-3">
        {types?.map((t, idx) => (
          <button
            key={idx}
            onClick={() => expand(idx)}
            className="group w-full text-left p-5 sm:p-6 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] hover:border-accent/50 hover:bg-foreground/[0.04] transition-all"
          >
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <h3 className="text-foreground text-base sm:text-lg font-medium">
                {idx + 1}. {t.name}
              </h3>
              <span className="text-[11px] uppercase tracking-[0.25em] text-foreground/30 group-hover:text-accent transition-colors shrink-0">
                Wybierz →
              </span>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex gap-2">
                <span className="text-foreground/40 shrink-0 min-w-[80px]">Kim jest:</span>
                <span className="text-foreground/80">{t.who}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-foreground/40 shrink-0 min-w-[80px]">Problem:</span>
                <span className="text-foreground/80">{t.problem}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-foreground/40 shrink-0 min-w-[80px]">Dlaczego Ty:</span>
                <span className="text-foreground/80">{t.match}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-between text-xs text-foreground/40">
        <span>Żaden nie pasuje?</span>
        <button
          onClick={async () => {
            await fetch('/api/onboarding/persona/path', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type, path: 'B' }),
            })
            location.reload()
          }}
          className="text-accent hover:text-accent/80 uppercase tracking-[0.25em]"
        >
          Przełącz na ścieżkę B (chat) →
        </button>
      </div>
    </div>
  )
}
