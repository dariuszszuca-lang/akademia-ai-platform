import { cookies } from 'next/headers'
import crypto from 'crypto'

const COOKIE_NAME = 'px-session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 dni

function getSecret(): string {
  return (
    process.env.SESSION_SECRET ??
    process.env.ADMIN_PASSWORD ??
    'fallback-not-secure-set-SESSION_SECRET'
  )
}

/**
 * Format cookie: <sub>.<hmac>
 * HMAC-SHA256(sub, secret)
 */
export function signSession(sub: string): string {
  const hmac = crypto
    .createHmac('sha256', getSecret())
    .update(sub)
    .digest('base64url')
  return `${sub}.${hmac}`
}

export function verifySession(value: string): string | null {
  const [sub, hmac] = value.split('.')
  if (!sub || !hmac) return null
  const expected = crypto
    .createHmac('sha256', getSecret())
    .update(sub)
    .digest('base64url')
  // timing-safe compare
  const a = Buffer.from(hmac)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!crypto.timingSafeEqual(a, b)) return null
  return sub
}

/**
 * Server-only: zwraca user.sub z cookie albo null.
 * Uzywaj w server components i API routes.
 */
export async function getServerUserId(): Promise<string | null> {
  try {
    const c = await cookies()
    const v = c.get(COOKIE_NAME)?.value
    if (!v) return null
    return verifySession(v)
  } catch {
    return null
  }
}

/**
 * Wymagany userId. Rzuca jesli brak.
 */
export async function requireServerUserId(): Promise<string> {
  const sub = await getServerUserId()
  if (!sub) throw new Error('UNAUTHORIZED')
  return sub
}

export const SESSION_COOKIE = COOKIE_NAME
export const SESSION_MAX_AGE = MAX_AGE
