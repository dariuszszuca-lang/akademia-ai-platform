import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBillingMode } from './mode'
import { getEffectivePlan } from './state'

const stateDependencies = vi.hoisted(() => ({
  subscription: {
    plan: 'starter',
    status: 'canceled',
  } as {
    plan: 'trial' | 'starter' | 'pro' | 'agency'
    status:
      | 'trialing'
      | 'active'
      | 'past_due'
      | 'canceled'
      | 'incomplete'
      | 'expired'
      | 'none'
  },
}))

vi.mock('@/lib/session', () => ({
  requireServerUserIdOrRedirect: vi.fn(async () => 'synthetic-user'),
}))

vi.mock('@/lib/store', () => ({
  storeGet: vi.fn(async () => stateDependencies.subscription),
  storeSet: vi.fn(async () => undefined),
}))

const stripeEnv = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_STARTER',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_AGENCY',
] as const

function setCompleteStripeEnv() {
  vi.stubEnv('STRIPE_SECRET_KEY', 'test-secret')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'test-webhook')
  vi.stubEnv('STRIPE_PRICE_STARTER', 'price_starter')
  vi.stubEnv('STRIPE_PRICE_PRO', 'price_pro')
  vi.stubEnv('STRIPE_PRICE_AGENCY', 'price_agency')
}

afterEach(() => vi.unstubAllEnvs())

describe('billing mode', () => {
  it('uses pilot mode when Stripe is absent', () => {
    for (const name of stripeEnv) vi.stubEnv(name, '')

    expect(getBillingMode()).toBe('pilot')
  })

  it.each(stripeEnv)(
    'uses pilot mode when %s is the missing part of the contract',
    (missingName) => {
      setCompleteStripeEnv()
      vi.stubEnv(missingName, '')

      expect(getBillingMode()).toBe('pilot')
    },
  )

  it('uses Stripe only with the complete five-variable contract', () => {
    setCompleteStripeEnv()

    expect(getBillingMode()).toBe('stripe')
  })
})

describe('effective plan', () => {
  it('grants active Pro access when the Stripe contract is partial', async () => {
    setCompleteStripeEnv()
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    stateDependencies.subscription = {
      plan: 'starter',
      status: 'canceled',
    }

    await expect(getEffectivePlan()).resolves.toEqual({
      plan: 'pro',
      active: true,
      sub: stateDependencies.subscription,
    })
  })

  it('preserves subscription gates when the Stripe contract is complete', async () => {
    setCompleteStripeEnv()
    stateDependencies.subscription = {
      plan: 'starter',
      status: 'active',
    }

    await expect(getEffectivePlan()).resolves.toEqual({
      plan: 'starter',
      active: true,
      sub: stateDependencies.subscription,
    })
  })
})
