'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import type { PlanDisplay, PlanId } from '@/lib/billing/plans'

type Props = {
  plans: PlanDisplay[]
  currentPlan: PlanId
}

export default function PricingCards({ plans, currentPlan }: Props) {
  const { user } = useAuth()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function checkout(plan: PlanId) {
    if (!user?.email) {
      setError('Zaloguj się aby kupić subskrypcję.')
      return
    }
    setLoading(plan)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, email: user.email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Błąd')
      if (data.url) window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown')
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        {plans.map(p => {
          const isCurrent = currentPlan === p.id
          return (
            <div
              key={p.id}
              className={
                'relative p-7 rounded-2xl border ' +
                (p.highlight
                  ? 'bg-accent/[0.06] border-accent/40'
                  : 'bg-foreground/[0.02] border-foreground/[0.08]')
              }
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent text-white text-[10px] uppercase tracking-[0.25em] rounded-full">
                  Polecany
                </div>
              )}

              <h3 className="font-display text-2xl text-foreground mb-2">{p.name}</h3>
              <p className="text-foreground/45 text-sm mb-5 leading-relaxed">{p.description}</p>

              <div className="mb-5">
                <span className="display-title text-foreground" style={{ fontSize: '42px', lineHeight: 1 }}>
                  {p.price}
                </span>
                <span className="text-foreground/40 text-sm ml-2">/ miesiąc</span>
              </div>

              <ul className="space-y-2 mb-6 text-sm text-foreground/75">
                {p.features.map((f, i) => (
                  <li key={i} className="flex gap-2 leading-relaxed">
                    <span className="text-accent shrink-0 mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="w-full py-3 rounded-full text-sm font-medium text-foreground/40 bg-foreground/[0.04] text-center border border-foreground/[0.08]">
                  Twój aktualny plan
                </div>
              ) : (
                <button
                  onClick={() => checkout(p.id)}
                  disabled={loading !== null}
                  className={
                    'w-full py-3 rounded-full text-sm font-medium transition ' +
                    (p.highlight
                      ? 'bg-accent text-white hover:bg-accent/90'
                      : 'bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.10] border border-foreground/[0.08]') +
                    ' disabled:opacity-50 disabled:cursor-wait'
                  }
                >
                  {loading === p.id ? 'Otwieram Stripe...' : p.ctaLabel}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm text-center">
          {error}
        </div>
      )}
    </div>
  )
}
