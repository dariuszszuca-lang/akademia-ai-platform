'use client'

import { useState } from 'react'
import type { BillingMode } from '@/lib/billing/mode'

export default function PortalButton({
  billingMode,
}: {
  billingMode: BillingMode
}) {
  const [loading, setLoading] = useState(false)

  async function open() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      setLoading(false)
    }
  }

  if (billingMode === 'pilot') return null

  return (
    <button
      onClick={open}
      disabled={loading}
      className="px-5 py-2.5 bg-accent text-white text-sm font-medium rounded-full hover:bg-accent/90 transition disabled:opacity-50"
    >
      {loading ? 'Otwieram...' : 'Zarządzaj subskrypcją (Stripe) →'}
    </button>
  )
}
