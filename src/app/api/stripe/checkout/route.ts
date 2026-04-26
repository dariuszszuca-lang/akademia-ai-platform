import { NextResponse } from 'next/server'
import { getStripe, getPriceId } from '@/lib/billing/stripe'
import { getServerUserId } from '@/lib/session'
import { getUserSubscription, setUserSubscription } from '@/lib/billing/state'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/stripe/checkout
 * body: { plan: 'starter' | 'pro' | 'agency', email: string }
 *
 * Tworzy Stripe Checkout session. Zwraca url do przekierowania.
 * Po sukcesie webhook /api/stripe/webhook zaktualizuje subscription state.
 */
export async function POST(req: Request) {
  const userId = await getServerUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { plan, email } = await req.json()
  if (plan !== 'starter' && plan !== 'pro' && plan !== 'agency') {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 })
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }

  const priceId = getPriceId(plan)
  if (!priceId) {
    return NextResponse.json({ error: `Stripe price not configured for ${plan}` }, { status: 500 })
  }

  try {
    const stripe = getStripe()
    const sub = await getUserSubscription()

    // Reuse Stripe customer jeśli mamy
    let customerId = sub.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { akademia_user_id: userId },
      })
      customerId = customer.id
      await setUserSubscription({ ...sub, stripeCustomerId: customerId })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://akademia-ai-platform.vercel.app'
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/settings/subscription?success=1`,
      cancel_url: `${baseUrl}/pricing?canceled=1`,
      metadata: { akademia_user_id: userId, plan },
      subscription_data: {
        metadata: { akademia_user_id: userId, plan },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    )
  }
}
