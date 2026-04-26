'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PersonaQuestion } from '@/data/onboarding/persona-questions'

type Message =
  | { role: 'ai'; content: string; intro?: boolean }
  | { role: 'user'; content: string; questionId: string }

type Props = {
  type: 'buyer' | 'seller'
  questions: PersonaQuestion[]
  initialAnswers: Record<string, string>
  resultPath: string
}

export default function PersonaChat({ type, questions, initialAnswers, resultPath }: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genStream, setGenStream] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isBuyer = type === 'buyer'

  // Inicjalizacja: intro + dotychczasowe odpowiedzi + nastepne pytanie
  useEffect(() => {
    const intro = isBuyer
      ? 'Cześć. Stworzymy razem personę Twojego klienta kupującego. Zadam Ci 6 pytań. Pisz spokojnie, swoimi słowami. Nie ma złych odpowiedzi.'
      : 'Cześć. Stworzymy razem personę Twojego klienta sprzedającego. Zadam Ci 6 pytań. Pisz spokojnie, swoimi słowami.'

    const msgs: Message[] = [{ role: 'ai', content: intro, intro: true }]

    let resumeIndex = 0
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const a = initialAnswers[q.id]?.trim()
      msgs.push({ role: 'ai', content: q.prompt })
      if (a) {
        msgs.push({ role: 'user', content: a, questionId: q.id })
        resumeIndex = i + 1
      } else {
        break
      }
    }

    setMessages(msgs)
    setCurrentIndex(resumeIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Autoscroll do dolu
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, generating, genStream])

  // Focus input gdy nowe pytanie czeka
  useEffect(() => {
    if (currentIndex < questions.length && !generating) {
      const t = setTimeout(() => inputRef.current?.focus(), 400)
      return () => clearTimeout(t)
    }
  }, [currentIndex, generating, questions.length])

  const current = currentIndex < questions.length ? questions[currentIndex] : null

  async function send() {
    if (!current || !draft.trim()) return
    const answer = draft.trim()
    setSaving(true)

    // Dodaj user message
    setMessages(prev => [...prev, { role: 'user', content: answer, questionId: current.id }])
    setDraft('')

    try {
      await fetch('/api/onboarding/persona/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, questionId: current.id, answer }),
      })
    } finally {
      setSaving(false)
    }

    const nextIdx = currentIndex + 1

    if (nextIdx < questions.length) {
      // Kolejne pytanie po krotkim opoznieniu (premium feel)
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'ai', content: questions[nextIdx].prompt }])
        setCurrentIndex(nextIdx)
      }, 500)
    } else {
      // Wszystkie pytania zebrane, generuj persone
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            role: 'ai',
            content: 'Świetnie. Mam wszystko czego potrzebuję. Generuję personę.',
          },
        ])
        setCurrentIndex(nextIdx)
        generate()
      }, 500)
    }
  }

  async function generate() {
    setGenerating(true)
    setGenStream('')
    try {
      const res = await fetch('/api/onboarding/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
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
      setGenStream(
        s => s + `\n\n[Błąd: ${err instanceof Error ? err.message : 'unknown'}]`,
      )
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      send()
    }
  }

  const allDone = currentIndex >= questions.length

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-12 flex flex-col h-[100dvh] sm:h-[calc(100vh-180px)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Heading */}
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.3em] text-accent mb-2">
          {isBuyer ? 'Persona kupującego' : 'Persona sprzedającego'} · Chat z AI
        </div>
        <div className="flex justify-between items-baseline">
          <h1 className="text-foreground text-2xl font-medium">
            {isBuyer ? 'Twój klient kupujący' : 'Twój klient sprzedający'}
          </h1>
          <span className="text-foreground/40 text-xs">
            {Math.min(currentIndex, questions.length)} / {questions.length} pytań
          </span>
        </div>
      </div>

      {/* Chat */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pr-2 space-y-4 pb-4"
      >
        {messages.map((m, i) => (
          <ChatBubble key={i} message={m} />
        ))}

        {generating && (
          <div className="bg-foreground/[0.02] border border-foreground/[0.08] rounded-2xl p-5 mt-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-accent mb-3">
              persona-{isBuyer ? 'kupujacy' : 'sprzedajacy'}.md
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-foreground/85">
              {genStream || (
                <span className="text-foreground/30">
                  <span className="inline-block w-2 h-3.5 bg-accent/60 animate-pulse align-middle" />
                </span>
              )}
            </pre>
          </div>
        )}
      </div>

      {/* Input */}
      {!allDone && (
        <div className="pt-4 pb-2 border-t border-foreground/[0.06] sticky bottom-0 bg-background/80 backdrop-blur-sm" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
          {current?.helper && (
            <p className="text-foreground/40 text-xs mb-2 leading-relaxed">{current.helper}</p>
          )}
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={current?.placeholder ?? 'Twoja odpowiedź...'}
              rows={3}
              className="flex-1 px-4 py-3 bg-foreground/[0.02] border border-foreground/[0.08] rounded-xl text-foreground placeholder:text-foreground/30 text-[14px] leading-relaxed focus:outline-none focus:border-accent/40 focus:bg-foreground/[0.04] transition-colors resize-none"
            />
            <button
              onClick={send}
              disabled={!draft.trim() || saving}
              className="self-end px-5 py-3 bg-accent text-white font-medium rounded-xl text-sm hover:bg-accent/90 transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {saving ? 'wysyłam...' : 'Wyślij →'}
            </button>
          </div>
          <div className="text-foreground/30 text-[11px] uppercase tracking-[0.25em] mt-2">
            ⌘/Ctrl + Enter
          </div>
        </div>
      )}
    </div>
  )
}

function ChatBubble({ message }: { message: Message }) {
  if (message.role === 'ai') {
    return (
      <div className="flex gap-3 animate-fade-in-up">
        <div className="shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-[11px] font-semibold">
          AI
        </div>
        <div
          className={
            'rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] text-[14px] leading-relaxed ' +
            (message.intro
              ? 'bg-accent/[0.06] border border-accent/20 text-foreground/85'
              : 'bg-foreground/[0.04] text-foreground/85')
          }
        >
          {message.content}
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-3 justify-end animate-fade-in-up">
      <div className="rounded-2xl rounded-tr-sm bg-accent text-white px-4 py-2.5 max-w-[85%] text-[14px] leading-relaxed whitespace-pre-wrap">
        {message.content}
      </div>
    </div>
  )
}
