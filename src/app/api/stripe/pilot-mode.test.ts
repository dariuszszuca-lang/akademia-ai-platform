import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dependencies = vi.hoisted(() => ({
  getStripe: vi.fn(() => {
    throw new Error('getStripe must not run in pilot mode')
  }),
  getPriceId: vi.fn(() => {
    throw new Error('getPriceId must not run in pilot mode')
  }),
  planFromPriceId: vi.fn(() => {
    throw new Error('planFromPriceId must not run in pilot mode')
  }),
  getServerUserId: vi.fn(() => {
    throw new Error('session must not be read in pilot mode')
  }),
  getUserSubscription: vi.fn(() => {
    throw new Error('subscription must not be read in pilot mode')
  }),
  setUserSubscription: vi.fn(() => {
    throw new Error('subscription must not be written in pilot mode')
  }),
  getSubscriptionForUser: vi.fn(() => {
    throw new Error('subscription must not be read in pilot mode')
  }),
  setSubscriptionForUser: vi.fn(() => {
    throw new Error('subscription must not be written in pilot mode')
  }),
  headers: vi.fn(() => {
    throw new Error('headers must not be read in pilot mode')
  }),
}))

vi.mock('@/lib/billing/stripe', () => ({
  getStripe: dependencies.getStripe,
  getPriceId: dependencies.getPriceId,
  planFromPriceId: dependencies.planFromPriceId,
}))

vi.mock('@/lib/session', () => ({
  getServerUserId: dependencies.getServerUserId,
}))

vi.mock('@/lib/billing/state', () => ({
  getUserSubscription: dependencies.getUserSubscription,
  setUserSubscription: dependencies.setUserSubscription,
  getSubscriptionForUser: dependencies.getSubscriptionForUser,
  setSubscriptionForUser: dependencies.setSubscriptionForUser,
}))

vi.mock('next/headers', () => ({
  headers: dependencies.headers,
}))

import { POST as checkoutPOST } from './checkout/route'
import { POST as portalPOST } from './portal/route'
import { POST as webhookPOST } from './webhook/route'

const stripeEnv = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_STARTER',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_AGENCY',
] as const

function unreadableRequest(): Request {
  return {
    json: vi.fn(() => {
      throw new Error('body must not be parsed in pilot mode')
    }),
    text: vi.fn(() => {
      throw new Error('body must not be parsed in pilot mode')
    }),
  } as unknown as Request
}

async function expectPilotUnavailable(response: Response) {
  expect(response.status).toBe(503)
  await expect(response.json()).resolves.toEqual({
    error: 'billing_unavailable',
    mode: 'pilot',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const name of stripeEnv) vi.stubEnv(name, '')
})

afterEach(() => vi.unstubAllEnvs())

describe('Stripe API in pilot mode', () => {
  it('blocks checkout before session, body and Stripe access', async () => {
    await expectPilotUnavailable(await checkoutPOST(unreadableRequest()))

    expect(dependencies.getServerUserId).not.toHaveBeenCalled()
    expect(dependencies.getStripe).not.toHaveBeenCalled()
  })

  it('blocks the customer portal before session, state and Stripe access', async () => {
    await expectPilotUnavailable(await portalPOST())

    expect(dependencies.getServerUserId).not.toHaveBeenCalled()
    expect(dependencies.getUserSubscription).not.toHaveBeenCalled()
    expect(dependencies.getStripe).not.toHaveBeenCalled()
  })

  it('blocks webhooks before headers, body and Stripe access', async () => {
    await expectPilotUnavailable(await webhookPOST(unreadableRequest()))

    expect(dependencies.headers).not.toHaveBeenCalled()
    expect(dependencies.getStripe).not.toHaveBeenCalled()
  })
})
