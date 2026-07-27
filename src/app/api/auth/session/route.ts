import { NextResponse } from 'next/server'
import { createSessionPostHandler } from '@/lib/auth-session'
import { verifyCognitoAccessToken } from '@/lib/cognito-token'
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session'

/**
 * POST /api/auth/session
 * body: { accessToken: string }
 *
 * Weryfikuje podpis, issuer, token_use i client_id tokenu Cognito,
 * a następnie ustawia httpOnly cookie z podpisanym user.sub.
 * Frontend wywoluje to w auth-context po SUCCESS od Cognito.
 */
export const POST = createSessionPostHandler({
  verifyAccessToken: verifyCognitoAccessToken,
  signSubject: signSession,
  cookieName: SESSION_COOKIE,
  cookieMaxAge: SESSION_MAX_AGE,
})

/**
 * DELETE /api/auth/session
 * Czysci cookie (logout server-side).
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return res
}
