export type BillingMode = 'pilot' | 'stripe'

const REQUIRED_STRIPE_ENV = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_STARTER',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_AGENCY',
] as const

export function getBillingMode(): BillingMode {
  return REQUIRED_STRIPE_ENV.every((name) =>
    Boolean(process.env[name]?.trim()),
  )
    ? 'stripe'
    : 'pilot'
}
