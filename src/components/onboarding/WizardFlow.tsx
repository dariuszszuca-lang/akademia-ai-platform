'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OnboardingQuestion, ExpressAnswers } from '@/lib/onboarding/types'
import ProgressBar from './ProgressBar'
import WizardQuestion from './WizardQuestion'

type Props = {
  questions: OnboardingQuestion[]
  initialAnswers: ExpressAnswers
  /** API endpoint zapisujacy odpowiedz (POST {questionId, answer}) */
  saveEndpoint: string
  /** Endpoint do generowania pliku po zakonczeniu (POST -> stream tekstu) */
  generateEndpoint: string
  /** Sciezka do redirect po zakonczeniu */
  resultPath: string
}

export default function WizardFlow({
  questions,
  initialAnswers,
  saveEndpoint,
  generateEndpoint,
  resultPath,
}: Props) {
  const router = useRouter()
  const [answers, setAnswers] = useState<ExpressAnswers>(initialAnswers)
  const [currentIndex, setCurrentIndex] = useState(() => {
    // Resume: pierwszy nieodpowiedziany
    const firstEmpty = questions.findIndex(q => !initialAnswers[q.id]?.trim())
    return firstEmpty === -1 ? questions.length - 1 : firstEmpty
  })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genStream, setGenStream] = useState('')

  const current = questions[currentIndex]
  const isLast = currentIndex === questions.length - 1
  const value = answers[current.id] ?? ''

  function handleChange(v: string) {
    setAnswers(prev => ({ ...prev, [current.id]: v }))
  }

  async function persist(questionId: string, answer: string) {
    setSaving(true)
    try {
      await fetch(saveEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, answer }),
      })
    } finally {
      setSaving(false)
    }
  }

  async function next() {
    if (!value.trim()) return
    await persist(current.id, value)
    if (isLast) {
      generate()
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  function back() {
    if (currentIndex > 0) setCurrentIndex(i => i - 1)
  }

  async function generate() {
    setGenerating(true)
    setGenStream('')
    try {
      const res = await fetch(generateEndpoint, { method: 'POST' })
      if (!res.body) throw new Error('no stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { value: chunk, done } = await reader.read()
        if (done) break
        setGenStream(prev => prev + decoder.decode(chunk))
      }
      // Po skonczeniu - krotka pauza i redirect na strone wyniku
      setTimeout(() => router.push(resultPath), 1200)
    } catch (err) {
      setGenStream(
        s => s + `\n\n[Blad: ${err instanceof Error ? err.message : 'unknown'}]`,
      )
    }
  }

  // Globalny skrot Esc -> wstecz
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !generating) back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentIndex, generating])

  if (generating) {
    return (
      <div className="max-w-2xl mx-auto py-16 space-y-8 animate-fade-in-up">
        <div className="text-center space-y-3">
          <div className="text-[11px] uppercase tracking-[0.3em] text-accent">
            AI tworzy Twój profil
          </div>
          <h1 className="text-foreground text-2xl font-medium">
            Czytam Twoje 15 odpowiedzi i piszę profil.md
          </h1>
          <p className="text-foreground/40 text-sm">
            Za chwilę będzie gotowy. Możesz spokojnie śledzić.
          </p>
        </div>

        <div className="bg-foreground/[0.02] border border-foreground/[0.08] rounded-xl p-8 min-h-[280px]">
          <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-foreground/85">
            {genStream || (
              <span className="text-foreground/30">
                <span className="inline-block w-2 h-4 bg-accent/60 animate-pulse align-middle" />
              </span>
            )}
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-12">
      <ProgressBar
        current={currentIndex + 1}
        total={questions.length}
        sectionLabel={current.sectionLabel}
      />

      <WizardQuestion
        key={current.id}
        question={current}
        initialValue={value}
        onChange={handleChange}
        onSubmit={next}
      />

      <div className="flex justify-between items-center pt-4 border-t border-foreground/[0.06]">
        <button
          type="button"
          onClick={back}
          disabled={currentIndex === 0}
          className="text-foreground/50 hover:text-foreground text-sm transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
        >
          ← Wstecz
        </button>
        <div className="text-[11px] uppercase tracking-[0.25em] text-foreground/30">
          {saving ? 'zapisuje...' : 'zapisane'}
        </div>
        <button
          type="button"
          onClick={next}
          disabled={!value.trim()}
          className="px-6 py-2.5 bg-accent text-white font-medium rounded-full text-sm hover:bg-accent/90 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
        >
          {isLast ? 'Wygeneruj profil →' : 'Dalej →'}
        </button>
      </div>
    </div>
  )
}
