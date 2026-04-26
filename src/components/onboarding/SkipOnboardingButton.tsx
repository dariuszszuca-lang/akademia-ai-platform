'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SkipOnboardingButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function skip() {
    setLoading(true)
    try {
      await fetch('/api/onboarding/complete', { method: 'POST' })
      router.push('/start')
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={skip}
      disabled={loading}
      className="text-foreground/40 hover:text-foreground/70 text-xs uppercase tracking-[0.25em] transition-colors disabled:opacity-50"
    >
      {loading ? 'Wchodzę...' : 'Pomiń persony, wejdź do platformy →'}
    </button>
  )
}
