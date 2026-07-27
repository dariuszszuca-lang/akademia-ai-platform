import { NextResponse } from 'next/server'

type SessionPostDependencies = {
  verifyAccessToken: (accessToken: string) => Promise<{ sub: string }>
  signSubject: (subject: string) => string
  cookieName: string
  cookieMaxAge: number
}

export class SessionConfigurationError extends Error {}

export function createSessionPostHandler({
  verifyAccessToken,
  signSubject,
  cookieName,
  cookieMaxAge,
}: SessionPostDependencies) {
  return async function POST(request: Request) {
    const body = await request.json().catch(() => null)
    const accessToken =
      isRecord(body) && typeof body.accessToken === 'string'
        ? body.accessToken
        : null

    if (!accessToken) {
      return NextResponse.json(
        { error: 'access_token_required' },
        { status: 400 },
      )
    }

    let subject: string
    try {
      const payload = await verifyAccessToken(accessToken)
      subject = payload.sub
    } catch (error) {
      if (error instanceof SessionConfigurationError) {
        console.error('[auth-session] configuration_error')
        return NextResponse.json(
          { error: 'authentication_unavailable' },
          { status: 503 },
        )
      }

      return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set({
      name: cookieName,
      value: signSubject(subject),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: cookieMaxAge,
      path: '/',
    })
    return response
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
