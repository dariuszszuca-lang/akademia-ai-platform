import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const COOKIE_NAME = 'admin_session'
const SESSION_DURATION_DAYS = 7
const SESSION_DURATION_SECONDS =
  SESSION_DURATION_DAYS * 24 * 60 * 60
const SESSION_TOKEN_VERSION = 1

type AdminSessionPayload = {
  v: number
  iat: number
  exp: number
}

function getExpectedPassword() {
  return process.env.ADMIN_PASSWORD || ''
}

function getSessionToken() {
  const secret =
    process.env.ADMIN_SESSION_SECRET || getExpectedPassword()
  if (!secret) return ''
  return createAdminSessionToken(secret)
}

function timingSafeTextEqual(
  actual: string,
  expected: string,
): boolean {
  const actualDigest = createHash('sha256').update(actual).digest()
  const expectedDigest = createHash('sha256').update(expected).digest()
  return timingSafeEqual(actualDigest, expectedDigest)
}

function signAdminSessionPayload(
  encodedPayload: string,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url')
}

export function createAdminSessionToken(
  secret: string,
  now: number = Date.now(),
): string {
  const issuedAt = Math.floor(now / 1000)
  const payload: AdminSessionPayload = {
    v: SESSION_TOKEN_VERSION,
    iat: issuedAt,
    exp: issuedAt + SESSION_DURATION_SECONDS,
  }
  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
  ).toString('base64url')
  const signature = signAdminSessionPayload(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

export function verifyAdminSessionToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): boolean {
  if (!token || !secret) return false

  try {
    const parts = token.split('.')
    if (parts.length !== 2) return false
    const [encodedPayload, signature] = parts
    if (
      !encodedPayload ||
      !signature ||
      !/^[A-Za-z0-9_-]+$/.test(encodedPayload) ||
      !/^[A-Za-z0-9_-]+$/.test(signature)
    ) {
      return false
    }

    const expectedSignature = signAdminSessionPayload(
      encodedPayload,
      secret,
    )
    const actualBuffer = Buffer.from(signature, 'base64url')
    const expectedBuffer = Buffer.from(
      expectedSignature,
      'base64url',
    )
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return false
    }

    const payloadBuffer = Buffer.from(
      encodedPayload,
      'base64url',
    )
    if (payloadBuffer.toString('base64url') !== encodedPayload) {
      return false
    }
    const payload = JSON.parse(
      payloadBuffer.toString('utf8'),
    ) as Partial<AdminSessionPayload>
    const { iat, exp } = payload
    if (
      payload.v !== SESSION_TOKEN_VERSION ||
      typeof iat !== 'number' ||
      typeof exp !== 'number' ||
      !Number.isInteger(iat) ||
      !Number.isInteger(exp) ||
      exp !== iat + SESSION_DURATION_SECONDS
    ) {
      return false
    }

    const nowSeconds = Math.floor(now / 1000)
    return iat <= nowSeconds && nowSeconds < exp
  } catch {
    return false
  }
}

export function verifyPassword(input: string): boolean {
  const expected = getExpectedPassword()
  if (!expected) return false
  return timingSafeTextEqual(input, expected)
}

export async function isAuthenticated(): Promise<boolean> {
  const secret =
    process.env.ADMIN_SESSION_SECRET || getExpectedPassword()
  if (!secret) return false
  const cookie = (await cookies()).get(COOKIE_NAME)
  return verifyAdminSessionToken(cookie?.value ?? '', secret)
}

export function createSessionResponse(
  redirectTo: string = '/admin',
) {
  const response = NextResponse.redirect(
    new URL(redirectTo, 'http://placeholder'),
  )
  const token = getSessionToken()
  const maxAge = SESSION_DURATION_SECONDS
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge,
  })
  return response
}

export function setSessionCookie(response: NextResponse) {
  const token = getSessionToken()
  const maxAge = SESSION_DURATION_SECONDS
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge,
  })
  return response
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return response
}

export function isAdminConfigured(): boolean {
  return Boolean(getExpectedPassword())
}
