'use client'

import { useState } from 'react'

type Props = {
  type: 'buyer' | 'seller'
  onChoose: (path: 'A' | 'B') => void
}

export default function PersonaPathSelector({ type, onChoose }: Props) {
  const [loading, setLoading] = useState<'A' | 'B' | null>(null)

  async function pick(path: 'A' | 'B') {
    setLoading(path)
    try {
      await fetch('/api/onboarding/persona/path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, path }),
      })
      onChoose(path)
    } catch {
      setLoading(null)
    }
  }

  const isBuyer = type === 'buyer'

  return (
    <div className="max-w-2xl mx-auto py-12 sm:py-16 space-y-10 animate-fade-in-up">
      <div className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.3em] text-accent">
          Persona klienta {isBuyer ? 'kupującego' : 'sprzedającego'}
        </div>
        <h1 className="text-foreground text-3xl sm:text-4xl font-medium tracking-tight">
          Kim jest Twój klient {isBuyer ? 'kupujący' : 'sprzedający'}?
        </h1>
        <p className="text-foreground/55 text-base leading-relaxed max-w-xl">
          Mamy dwie ścieżki. Wybierz tę która pasuje do Twojej sytuacji.
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => pick('B')}
          className="group w-full text-left p-6 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] hover:border-accent/40 hover:bg-foreground/[0.04] transition-all disabled:opacity-50 disabled:cursor-wait"
        >
          <div className="flex items-baseline justify-between gap-4 mb-2">
            <h2 className="text-foreground text-lg font-medium">
              Znam swoich klientów
            </h2>
            <span className="text-[11px] uppercase tracking-[0.25em] text-foreground/40 group-hover:text-accent transition-colors">
              {loading === 'B' ? 'wczytuję...' : '6 pytań · ~10 min →'}
            </span>
          </div>
          <p className="text-foreground/50 text-sm leading-relaxed">
            Masz już doświadczenie. Pomyślisz o swoich ostatnich klientach i
            odpowiesz na 6 pytań w czacie z AI. AI ułoży personę z Twoich
            obserwacji.
          </p>
        </button>

        <button
          type="button"
          disabled={loading !== null}
          onClick={() => pick('A')}
          className="group w-full text-left p-6 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] hover:border-accent/40 hover:bg-foreground/[0.04] transition-all disabled:opacity-50 disabled:cursor-wait"
        >
          <div className="flex items-baseline justify-between gap-4 mb-2">
            <h2 className="text-foreground text-lg font-medium">
              Dopiero zaczynam, AI niech zaproponuje
            </h2>
            <span className="text-[11px] uppercase tracking-[0.25em] text-foreground/40 group-hover:text-accent transition-colors">
              {loading === 'A' ? 'wczytuję...' : '3 typy · ~5 min →'}
            </span>
          </div>
          <p className="text-foreground/50 text-sm leading-relaxed">
            Nie masz jeszcze typowych klientów. AI na bazie Twojego profilu
            zaproponuje 3 najbardziej prawdopodobne typy. Wybierzesz jeden, a AI
            go rozwinie do pełnej persony.
          </p>
        </button>
      </div>

      <p className="text-foreground/30 text-xs">
        Decyzję możesz zmienić, wystarczy że wrócisz do tej strony.
      </p>
    </div>
  )
}
