'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Link from 'next/link'

type Props = {
  profil: string | null
  buyer: string | null
  seller: string | null
  deepGenerated: boolean
}

type Tab = 'profil' | 'buyer' | 'seller'

export default function ProfilFiles({ profil, buyer, seller, deepGenerated }: Props) {
  const tabs: { id: Tab; label: string; subtitle: string; content: string | null; editHref: string }[] = [
    {
      id: 'profil',
      label: 'profil.md',
      subtitle: deepGenerated ? 'Pełny profil (Express + Deep)' : 'Profil podstawowy (Express)',
      content: profil,
      editHref: '/onboarding/express',
    },
    {
      id: 'buyer',
      label: 'persona-kupujacy.md',
      subtitle: 'Twój typowy klient kupujący',
      content: buyer,
      editHref: '/onboarding/persona/buyer',
    },
    {
      id: 'seller',
      label: 'persona-sprzedajacy.md',
      subtitle: 'Twój typowy klient sprzedający',
      content: seller,
      editHref: '/onboarding/persona/seller',
    },
  ]

  const firstAvailable = tabs.find(t => t.content)?.id ?? 'profil'
  const [active, setActive] = useState<Tab>(firstAvailable)
  const [copied, setCopied] = useState(false)
  const current = tabs.find(t => t.id === active)!

  async function copy() {
    if (!current.content) return
    await navigator.clipboard.writeText(current.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-foreground/[0.06]">
        {tabs.map(t => {
          const has = Boolean(t.content)
          return (
            <button
              key={t.id}
              onClick={() => has && setActive(t.id)}
              disabled={!has}
              className={
                'relative px-4 py-3 text-sm transition-colors ' +
                (active === t.id
                  ? 'text-foreground'
                  : has
                  ? 'text-foreground/50 hover:text-foreground'
                  : 'text-foreground/20 cursor-not-allowed')
              }
            >
              <span className="font-mono text-[12px]">{t.label}</span>
              {!has && <span className="ml-2 text-[10px] uppercase tracking-[0.25em]">brak</span>}
              {active === t.id && (
                <span className="absolute -bottom-px left-0 right-0 h-px bg-accent" />
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {current.content ? (
        <div>
          <div className="flex justify-between items-baseline mb-3">
            <p className="text-foreground/40 text-xs">{current.subtitle}</p>
            <div className="flex gap-3 text-xs">
              <button
                onClick={copy}
                className="text-foreground/50 hover:text-foreground transition-colors uppercase tracking-[0.2em]"
              >
                {copied ? 'skopiowano ✓' : 'kopiuj'}
              </button>
              <Link
                href={current.editHref}
                className="text-foreground/50 hover:text-accent transition-colors uppercase tracking-[0.2em]"
              >
                edytuj odpowiedzi
              </Link>
            </div>
          </div>

          <div
            className="bg-[#fafaf7] text-[#0a0a0b] rounded-2xl p-8 sm:p-12 shadow-[0_20px_80px_rgba(0,0,0,0.5)]"
            style={{ fontFeatureSettings: '"liga" 1, "ss01" 1' }}
          >
            <article
              className="prose prose-sm sm:prose-base max-w-none
                prose-headings:font-medium prose-headings:tracking-tight
                prose-h1:text-2xl prose-h1:mb-6 prose-h1:mt-0
                prose-h2:text-base prose-h2:uppercase prose-h2:tracking-[0.15em] prose-h2:text-black/60 prose-h2:mt-8 prose-h2:mb-3
                prose-ul:my-2 prose-li:my-0
                prose-strong:text-black
                prose-table:text-sm prose-th:bg-black/[0.04] prose-th:text-left prose-td:py-2"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{current.content}</ReactMarkdown>
            </article>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-foreground/40 text-sm">
          Ten plik jeszcze nie został wygenerowany.
        </div>
      )}
    </div>
  )
}
