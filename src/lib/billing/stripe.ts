import Stripe from 'stripe'

const apiKey = process.env.STRIPE_SECRET_KEY
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!apiKey) {
    throw new Error('STRIPE_SECRET_KEY not configured')
  }
  if (!_stripe) {
    _stripe = new Stripe(apiKey, { apiVersion: '2026-04-22.dahlia' })
  }
  return _stripe
}

/**
 * Mapowanie planId -> Stripe price ID (z env vars).
 * Każdy plan = osobny product/price w Stripe Dashboard.
 */
export function getPriceId(planId: 'starter' | 'pro' | 'agency'): string | null {
  switch (planId) {
    case 'starter':
      return process.env.STRIPE_PRICE_STARTER ?? null
    case 'pro':
      return process.env.STRIPE_PRICE_PRO ?? null
    case 'agency':
      return process.env.STRIPE_PRICE_AGENCY ?? null
  }
}

export function planFromPriceId(priceId: string): 'starter' | 'pro' | 'agency' | null {
  if (priceId === process.env.STRIPE_PRICE_STARTER) return 'starter'
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_AGENCY) return 'agency'
  return null
}
