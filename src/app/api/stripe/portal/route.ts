import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/billing/stripe'
import { getServerUserId } from '@/lib/session'
import { getUserSubscription } from '@/lib/billing/state'

/**
 * POST /api/stripe/portal
 * Tworzy Stripe Customer Portal session — user może zarządzać subskrypcją (zmiana planu, anulowanie, faktury).
 */
export async function POST() {
  const userId = await getServerUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sub = await getUserSubscription()
  if (!sub.stripeCustomerId) {
    return NextResponse.json({ error: 'no Stripe customer (no active subscription yet)' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://akademia-ai-platform.vercel.app'
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${baseUrl}/settings/subscription`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    )
  }
}
