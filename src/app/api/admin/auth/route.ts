import { NextResponse } from 'next/server'
import {
  isAdminConfigured,
  setSessionCookie,
  verifyPassword,
} from '@/lib/admin-auth'
import { LIMITS, rateLimit } from '@/lib/rate-limit'

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
  const limit = await rateLimit(
    'admin-auth',
    identifier,
    LIMITS.ADMIN_AUTH.limit,
    LIMITS.ADMIN_AUTH.windowMinutes,
  )
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts' },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.resetIn) },
      },
    )
  }

  if (!verifyPassword(password)) {
    return NextResponse.json(
      { error: 'Invalid password' },
      { status: 401 },
    )
  }

  const response = NextResponse.json({ ok: true })
  return setSessionCookie(response)
}
