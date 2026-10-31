import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PricingPage from './page'
import { PLAN_DISPLAY } from '@/lib/billing/plans'

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

describe('plans carry no prices until Darek sets them', () => {
  it('keeps every plan without an amount', () => {
    for (const plan of PLAN_DISPLAY) {
      expect(plan.price).toBe('')
      expect(plan.priceMonthly).toBe(0)
    }
  })
})

describe('PricingPage billing mode', () => {
  it('shows pilot access without checkout or Stripe billing copy', async () => {
    const html = renderToStaticMarkup(await PricingPage())

    expect(html.match(/Płatności uruchomimy po pilotażu/g)).toHaveLength(2)
    expect(html).toContain('Dostęp bez opłat na czas startu')
    expect(html).not.toMatch(/\d+\s*zł/)
    expect(html).not.toContain('panelu Stripe')
  })

  it('preserves checkout and recurring billing copy in Stripe mode', async () => {
    mocks.billingMode = 'stripe'

    const html = renderToStaticMarkup(await PricingPage())

    expect(html).toContain('Wybierz Start')
    expect(html).toContain('Porozmawiajmy')
    expect(html).not.toMatch(/\d+\s*zł/)
    expect(html).toContain('panelu Stripe')
  })
})
