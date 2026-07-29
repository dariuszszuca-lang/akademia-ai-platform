import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PLAN_DISPLAY } from '@/lib/billing/plans'
import PortalButton from './PortalButton'
import PricingCards from './PricingCards'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      email: 'pilot@example.com',
    },
  }),
}))

describe('billing actions', () => {
  it('replaces every non-current checkout action in pilot mode', () => {
    const html = renderToStaticMarkup(
      <PricingCards
        plans={PLAN_DISPLAY}
        currentPlan="pro"
        billingMode="pilot"
      />,
    )

    expect(html.match(/Płatności uruchomimy po pilotażu/g)).toHaveLength(2)
    expect(html).not.toContain('<button')
    expect(html).not.toContain('Otwieram Stripe')
  })

  it('keeps checkout actions available in Stripe mode', () => {
    const html = renderToStaticMarkup(
      <PricingCards
        plans={PLAN_DISPLAY}
        currentPlan="pro"
        billingMode="stripe"
      />,
    )

    expect(html.match(/<button/g)).toHaveLength(2)
    expect(html).not.toContain('Płatności uruchomimy po pilotażu')
  })

  it('never renders a portal action in pilot mode', () => {
    const html = renderToStaticMarkup(
      <PortalButton billingMode="pilot" />,
    )

    expect(html).toBe('')
  })

  it('keeps the portal action in Stripe mode', () => {
    const html = renderToStaticMarkup(
      <PortalButton billingMode="stripe" />,
    )

    expect(html).toContain('Zarządzaj subskrypcją (Stripe)')
  })
})
