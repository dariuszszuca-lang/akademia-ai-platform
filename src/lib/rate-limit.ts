import {
  storeDelete,
  storeGet,
  storeIncrementWithExpiry,
} from '@/lib/store'

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

const RATE_LIMIT_TTL_MARGIN_SECONDS = 5

type RateLimitWindow = {
  key: string
  expiresAtEpochSeconds: number
  resetIn: number
}

function rateLimitWindow(
  bucket: string,
  identifier: string,
  windowMinutes: number,
): RateLimitWindow {
  const now = Date.now()
  const windowMs = windowMinutes * 60 * 1000
  const windowStart = Math.floor(now / windowMs)
  const resetAt = (windowStart + 1) * windowMs

  return {
    key: `rate:${bucket}:${identifier}:${windowStart}`,
    expiresAtEpochSeconds:
      Math.ceil(resetAt / 1000) +
      RATE_LIMIT_TTL_MARGIN_SECONDS,
    resetIn: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  }
}

export async function rateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowMinutes: number = 1,
): Promise<RateLimitResult> {
  const window = rateLimitWindow(
    bucket,
    identifier,
    windowMinutes,
  )
  const current = await storeIncrementWithExpiry(
    window.key,
    window.expiresAtEpochSeconds,
  )
  if (current > limit) {
    return {
      ok: false,
      remaining: 0,
      resetIn: window.resetIn,
    }
  }

  return {
    ok: true,
    remaining: Math.max(0, limit - current),
    resetIn: window.resetIn,
  }
}

export async function getRateLimitStatus(
  bucket: string,
  identifier: string,
  limit: number,
  windowMinutes: number = 1,
): Promise<RateLimitResult> {
  const window = rateLimitWindow(
    bucket,
    identifier,
    windowMinutes,
  )
  const current = (await storeGet<number>(window.key)) ?? 0
  return {
    ok: current < limit,
    remaining: Math.max(0, limit - current),
    resetIn: window.resetIn,
  }
}

export async function clearRateLimit(
  bucket: string,
  identifier: string,
  windowMinutes: number = 1,
): Promise<void> {
  const window = rateLimitWindow(
    bucket,
    identifier,
    windowMinutes,
  )
  await storeDelete(window.key)
}

/**
 * Predefiniowane limity dla rożnych endpointów.
 */
export const LIMITS = {
  ADMIN_AUTH: { limit: 5, windowMinutes: 15 },
  AGENT_RUN: { limit: 30, windowMinutes: 1 }, // 30 wywołań agenta na minutę
  PROFIL_GENERATE: { limit: 5, windowMinutes: 1 }, // 5 generowań na minutę (drogi LLM call)
  PERSONA_GENERATE: { limit: 5, windowMinutes: 1 },
  PERSONA_TYPES: { limit: 10, windowMinutes: 1 },
  AUTH_SESSION: { limit: 20, windowMinutes: 1 },
  STRIPE_CHECKOUT: { limit: 5, windowMinutes: 1 },
}
