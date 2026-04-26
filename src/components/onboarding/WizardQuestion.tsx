'use client'

import { useEffect, useRef, useState } from 'react'
import type { OnboardingQuestion } from '@/lib/onboarding/types'

type Props = {
  question: OnboardingQuestion
  initialValue: string
  onChange: (value: string) => void
  onSubmit: () => void
}

export default function WizardQuestion({ question, initialValue, onChange, onSubmit }: Props) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)

  // Reset state gdy zmienia sie pytanie
  useEffect(() => {
    setValue(initialValue)
  }, [question.id, initialValue])

  // Focus input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 320)
    return () => clearTimeout(t)
  }, [question.id])

  function update(v: string) {
    setValue(v)
    onChange(v)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (value.trim()) onSubmit()
    }
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <div>
        <h2 className="text-foreground text-2xl sm:text-3xl font-medium leading-snug tracking-tight">
          {question.prompt}
        </h2>
        {question.helper && (
          <p className="mt-3 text-foreground/45 text-sm leading-relaxed">{question.helper}</p>
        )}
      </div>

      {question.type === 'select' && question.options ? (
        <div className="space-y-2">
          {question.options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                update(opt.value)
                setTimeout(onSubmit, 220)
              }}
              className={
                'w-full text-left px-5 py-4 rounded-xl border transition-all duration-200 ' +
                (value === opt.value
                  ? 'bg-accent-light border-accent/60 text-foreground'
                  : 'bg-foreground/[0.02] border-foreground/[0.08] text-foreground/80 hover:border-foreground/25 hover:bg-foreground/[0.04]')
              }
            >
              <span className="text-[15px]">{opt.label}</span>
            </button>
          ))}
        </div>
      ) : question.type === 'textarea' ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={e => update(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={question.placeholder}
          rows={5}
          className="w-full px-5 py-4 bg-foreground/[0.02] border border-foreground/[0.08] rounded-xl text-foreground placeholder:text-foreground/30 text-[15px] leading-relaxed focus:outline-none focus:border-accent/40 focus:bg-foreground/[0.04] transition-colors resize-none"
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={e => update(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={question.placeholder}
          className="w-full px-5 py-4 bg-foreground/[0.02] border border-foreground/[0.08] rounded-xl text-foreground placeholder:text-foreground/30 text-[15px] focus:outline-none focus:border-accent/40 focus:bg-foreground/[0.04] transition-colors"
        />
      )}

      {question.type !== 'select' && (
        <div className="text-foreground/30 text-[11px] uppercase tracking-[0.25em]">
          ⌘/Ctrl + Enter żeby przejść dalej
        </div>
      )}
    </div>
  )
}
