import { storeGet, storeSet } from '@/lib/store'

/**
 * Rate limiter oparty o KV.
 * Klucz: rate:<bucket>:<userId|ip>:<minute>
 * Co minute zaczyna się nowy bucket.
 */

type RateLimitResult = {
  ok: boolean
  remaining: number
  resetIn: number // sekund do resetu
}

export async function rateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowMinutes: number = 1,
): Promise<RateLimitResult> {
  const now = new Date()
  const windowStart = Math.floor(now.getTime() / (windowMinutes * 60 * 1000))
  const key = `rate:${bucket}:${identifier}:${windowStart}`

  const current = (await storeGet<number>(key)) ?? 0
  if (current >= limit) {
    const resetIn = Math.ceil(((windowStart + 1) * windowMinutes * 60 * 1000 - now.getTime()) / 1000)
    return { ok: false, remaining: 0, resetIn }
  }

  await storeSet(key, current + 1)
  return { ok: true, remaining: limit - current - 1, resetIn: 0 }
}

/**
 * Predefiniowane limity dla rożnych endpointów.
 */
export const LIMITS = {
  AGENT_RUN: { limit: 30, windowMinutes: 1 }, // 30 wywołań agenta na minutę
  PROFIL_GENERATE: { limit: 5, windowMinutes: 1 }, // 5 generowań na minutę (drogi LLM call)
  PERSONA_GENERATE: { limit: 5, windowMinutes: 1 },
  PERSONA_TYPES: { limit: 10, windowMinutes: 1 },
  AUTH_SESSION: { limit: 20, windowMinutes: 1 },
  STRIPE_CHECKOUT: { limit: 5, windowMinutes: 1 },
}
