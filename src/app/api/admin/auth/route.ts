import { NextResponse } from 'next/server'
import {
  isAdminConfigured,
  setSessionCookie,
  verifyPassword,
} from '@/lib/admin-auth'
import {
  clearRateLimit,
  getRateLimitStatus,
  LIMITS,
  rateLimit,
} from '@/lib/rate-limit'

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      {
        error:
          'Admin password is not configured (ADMIN_PASSWORD env var missing)',
      },
      { status: 503 },
    )
  }

  let body: { password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid body' },
      { status: 400 },
    )
  }

  const { password } = body
  if (!password || typeof password !== 'string') {
    return NextResponse.json(
      { error: 'Password required' },
      { status: 400 },
    )
  }

  const identifier =
    request.headers
      .get('x-forwarded-for')
      ?.split(',')[0]
      ?.trim() || 'unknown'
  const status = await getRateLimitStatus(
    'admin-auth',
    identifier,
    LIMITS.ADMIN_AUTH.limit,
    LIMITS.ADMIN_AUTH.windowMinutes,
  )
  if (!status.ok) {
    return NextResponse.json(
      { error: 'Too many attempts' },
      {
        status: 429,
        headers: { 'Retry-After': String(status.resetIn) },
      },
    )
  }

  if (!verifyPassword(password)) {
    const failure = await rateLimit(
      'admin-auth',
      identifier,
      LIMITS.ADMIN_AUTH.limit,
      LIMITS.ADMIN_AUTH.windowMinutes,
    )
    if (!failure.ok) {
      return NextResponse.json(
        { error: 'Too many attempts' },
        {
          status: 429,
          headers: {
            'Retry-After': String(failure.resetIn),
          },
        },
      )
    }
    return NextResponse.json(
      { error: 'Invalid password' },
      { status: 401 },
    )
  }

  await clearRateLimit(
    'admin-auth',
    identifier,
    LIMITS.ADMIN_AUTH.windowMinutes,
  )
  const response = NextResponse.json({ ok: true })
  return setSessionCookie(response)
}
