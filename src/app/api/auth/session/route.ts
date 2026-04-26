import { NextResponse } from 'next/server'
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session'

/**
 * POST /api/auth/session
 * body: { sub: string }
 *
 * Ustawia httpOnly cookie z signed user.sub po pomyslnym Cognito login/confirm.
 * Frontend wywoluje to w auth-context po SUCCESS od Cognito.
 */
export async function POST(req: Request) {
  const { sub } = await req.json()
  if (typeof sub !== 'string' || sub.length < 3) {
    return NextResponse.json({ error: 'invalid sub' }, { status: 400 })
  }
  const value = signSession(sub)
  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
  return res
}

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
