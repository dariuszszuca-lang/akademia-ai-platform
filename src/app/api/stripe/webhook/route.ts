import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getStripe, planFromPriceId } from '@/lib/billing/stripe'
import { getSubscriptionForUser, setSubscriptionForUser } from '@/lib/billing/state'
import type { UserSubscription, SubscriptionStatus } from '@/lib/billing/plans'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

/**
 * POST /api/stripe/webhook
 * Stripe webhook endpoint. Aktualizuje subscription state w KV.
 *
 * Eventy:
 * - checkout.session.completed → user wlasnie zaplacil
 * - customer.subscription.updated → zmiana planu / cancel scheduled
 * - customer.subscription.deleted → cancel weszedl w zycie
 * - invoice.payment_failed → past_due
 */
export async function POST(req: Request) {
  const sig = (await headers()).get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) {
    return NextResponse.json({ error: 'webhook not configured' }, { status: 400 })
  }

  const body = await req.text()
  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    return NextResponse.json(
      { error: `signature verify failed: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 400 },
    )
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.akademia_user_id
        if (!userId || !session.subscription) break
        const stripe = getStripe()
        const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string)
        await applyStripeSub(userId, stripeSub)
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const stripeSub = event.data.object as Stripe.Subscription
        const userId = stripeSub.metadata?.akademia_user_id
        if (!userId) break
        await applyStripeSub(userId, stripeSub)
        break
      }
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as Stripe.Subscription
        const userId = stripeSub.metadata?.akademia_user_id
        if (!userId) break
        const existing = await getSubscriptionForUser(userId)
        if (!existing) break
        await setSubscriptionForUser(userId, {
          ...existing,
          status: 'canceled',
          plan: 'trial', // downgrade z powrotem
        })
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        // @ts-expect-error - subscription is on Invoice but typed as expandable
        const subId = invoice.subscription as string | null
        if (!subId) break
        const stripe = getStripe()
        const stripeSub = await stripe.subscriptions.retrieve(subId)
        const userId = stripeSub.metadata?.akademia_user_id
        if (!userId) break
        const existing = await getSubscriptionForUser(userId)
        if (!existing) break
        await setSubscriptionForUser(userId, { ...existing, status: 'past_due' })
        break
      }
      default:
        // ignore other events
        break
    }
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[stripe-webhook]', err)
    return NextResponse.json({ error: 'handler failed' }, { status: 500 })
  }
}

async function applyStripeSub(userId: string, stripeSub: Stripe.Subscription): Promise<void> {
  const item = stripeSub.items.data[0]
  if (!item) return
  const plan = planFromPriceId(item.price.id)
  if (!plan) return

  const status = mapStripeStatus(stripeSub.status)
  const existing = (await getSubscriptionForUser(userId)) ?? {
    plan: 'trial' as const,
    status: 'none' as const,
  }

  // @ts-expect-error - current_period_end exists on Subscription items
  const periodEnd = item.current_period_end ?? stripeSub.current_period_end
  const next: UserSubscription = {
    ...existing,
    plan,
    status,
    stripeCustomerId: typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id,
    stripeSubscriptionId: stripeSub.id,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
  }

  await setSubscriptionForUser(userId, next)
}

function mapStripeStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    case 'incomplete':
    case 'incomplete_expired':
      return 'incomplete'
    default:
      return 'none'
  }
}
