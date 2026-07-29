import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const COOKIE_NAME = 'admin_session'
const SESSION_DURATION_DAYS = 7

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

export function createAdminSessionToken(secret: string): string {
  return createHmac('sha256', secret)
    .update('admin-session-v1')
    .digest('base64url')
}

export function verifyAdminSessionToken(
  token: string,
  secret: string,
): boolean {
  if (!token || !secret) return false

  const expected = createAdminSessionToken(secret)
  const actualBuffer = Buffer.from(token)
  const expectedBuffer = Buffer.from(expected)

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  )
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
  const maxAge = SESSION_DURATION_DAYS * 24 * 60 * 60
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
  const maxAge = SESSION_DURATION_DAYS * 24 * 60 * 60
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
