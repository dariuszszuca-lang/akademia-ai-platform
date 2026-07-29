import { storeGet, storeSet } from '@/lib/store'
import { requireServerUserIdOrRedirect } from '@/lib/session'
import {
  newTrialSubscription,
  isPlanActive,
  type UserSubscription,
  type PlanId,
} from './plans'
import { getBillingMode } from './mode'

function subKey(userId: string): string {
  return `user:${userId}:subscription`
}

/**
 * Pobiera aktualną subskrypcję usera.
 * Jeśli pierwszy raz, zwraca + zapisuje nowy trial (14 dni).
 */
export async function getUserSubscription(): Promise<UserSubscription> {
  const userId = await requireServerUserIdOrRedirect()
  const existing = await storeGet<UserSubscription>(subKey(userId))
  if (existing) return existing

  // First time - start trial
  const fresh = newTrialSubscription()
  await storeSet(subKey(userId), fresh)
  return fresh
}

export async function setUserSubscription(sub: UserSubscription): Promise<void> {
  const userId = await requireServerUserIdOrRedirect()
  await storeSet(subKey(userId), sub)
}

/**
 * Set subscription dla konkretnego usera (uzywane w webhook gdzie nie mamy cookie).
 */
export async function setSubscriptionForUser(userId: string, sub: UserSubscription): Promise<void> {
  await storeSet(subKey(userId), sub)
}

/**
 * Get subscription dla konkretnego usera (np. webhook).
 */
export async function getSubscriptionForUser(userId: string): Promise<UserSubscription | null> {
  return storeGet<UserSubscription>(subKey(userId))
}

/**
 * Zwraca aktualny plan ID.
 *
 * W jawnym trybie pilotażowym każdy użytkownik ma aktywny dostęp Pro.
 * Bramka subskrypcji uruchamia się dopiero przy kompletnym kontrakcie Stripe.
 */
export async function getEffectivePlan(): Promise<{
  plan: PlanId | 'expired'
  active: boolean
  sub: UserSubscription
}> {
  const sub = await getUserSubscription()
  if (getBillingMode() === 'pilot') {
    return { plan: 'pro', active: true, sub }
  }
  const active = isPlanActive(sub)
  return {
    plan: active ? sub.plan : 'expired',
    active,
    sub,
  }
}
