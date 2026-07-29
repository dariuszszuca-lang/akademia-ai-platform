import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PricingPage from './page'

const mocks = vi.hoisted(() => ({
  billingMode: 'pilot' as 'pilot' | 'stripe',
  subscription: {
    plan: 'pro' as const,
    status: 'active' as const,
  },
}))

vi.mock('@/lib/billing/mode', () => ({
  getBillingMode: () => mocks.billingMode,
}))

vi.mock('@/lib/billing/state', () => ({
  getUserSubscription: vi.fn(async () => mocks.subscription),
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      email: 'pilot@example.com',
    },
  }),
}))

beforeEach(() => {
  mocks.billingMode = 'pilot'
})

describe('PricingPage billing mode', () => {
  it('shows pilot access without checkout or Stripe billing copy', async () => {
    const html = renderToStaticMarkup(await PricingPage())

    expect(html.match(/Płatności uruchomimy po pilotażu/g)).toHaveLength(2)
    expect(html).toContain('Aktywny dostęp pilotażowy Pro')
    expect(html).not.toContain('panelu Stripe')
  })

  it('preserves checkout and recurring billing copy in Stripe mode', async () => {
    mocks.billingMode = 'stripe'

    const html = renderToStaticMarkup(await PricingPage())

    expect(html).toContain('Zacznij Starter')
    expect(html).toContain('Skontaktuj się')
    expect(html).toContain('panelu Stripe')
  })
})
