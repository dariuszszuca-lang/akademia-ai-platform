import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SubscriptionSettingsPage from './page'

const mocks = vi.hoisted(() => ({
  billingMode: 'pilot' as 'pilot' | 'stripe',
  subscription: {
    plan: 'trial' as 'trial' | 'starter' | 'pro' | 'agency',
    status: 'trialing' as
      | 'trialing'
      | 'active'
      | 'past_due'
      | 'canceled'
      | 'incomplete'
      | 'expired'
      | 'none',
    trialEnd: '2099-01-01T00:00:00.000Z',
    currentPeriodEnd: undefined as string | undefined,
    stripeCustomerId: undefined as string | undefined,
  },
}))

vi.mock('@/lib/billing/mode', () => ({
  getBillingMode: () => mocks.billingMode,
}))

vi.mock('@/lib/billing/state', () => ({
  getUserSubscription: vi.fn(async () => mocks.subscription),
}))

beforeEach(() => {
  mocks.billingMode = 'pilot'
  mocks.subscription = {
    plan: 'trial',
    status: 'trialing',
    trialEnd: '2099-01-01T00:00:00.000Z',
    currentPeriodEnd: undefined,
    stripeCustomerId: undefined,
  }
})

describe('SubscriptionSettingsPage billing mode', () => {
  it('shows only pilot access details when billing is unavailable', async () => {
    const html = renderToStaticMarkup(await SubscriptionSettingsPage())

    expect(html).toContain('Dostęp pilotażowy Pro')
    expect(html).not.toContain('trialu')
    expect(html).not.toContain('odnawia się')
    expect(html).not.toContain('faktur')
    expect(html).not.toContain('anulow')
    expect(html).not.toContain('Stripe')
  })

  it('preserves subscription and portal details in Stripe mode', async () => {
    mocks.billingMode = 'stripe'
    mocks.subscription = {
      plan: 'pro',
      status: 'active',
      trialEnd: '2099-01-01T00:00:00.000Z',
      currentPeriodEnd: '2099-02-01T00:00:00.000Z',
      stripeCustomerId: 'synthetic-customer',
    }

    const html = renderToStaticMarkup(await SubscriptionSettingsPage())

    expect(html).toContain('Plan odnawia się')
    expect(html).toContain('Zarządzaj subskrypcją (Stripe)')
  })
})
