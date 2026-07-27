import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSessionPostHandler } from './auth-session'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('session creation boundary', () => {
  it('does not accept an unsigned subject from the request body', async () => {
    const signSubject = vi.fn()
    const handler = createSessionPostHandler({
      verifyAccessToken: vi.fn(),
      signSubject,
      cookieName: 'px-session',
      cookieMaxAge: 3600,
    })

    const response = await handler(
      jsonRequest({ sub: 'another-user-account' }),
    )

    expect(response.status).toBe(400)
    expect(signSubject).not.toHaveBeenCalled()
  })

  it('signs only the subject returned by verified Cognito token', async () => {
    const signSubject = vi.fn(() => 'signed-cookie')
    const handler = createSessionPostHandler({
      verifyAccessToken: async () => ({ sub: 'verified-user' }),
      signSubject,
      cookieName: 'px-session',
      cookieMaxAge: 3600,
    })

    const response = await handler(jsonRequest({ accessToken: 'jwt-value' }))

    expect(response.status).toBe(200)
    expect(signSubject).toHaveBeenCalledWith('verified-user')
    expect(response.headers.get('set-cookie')).toContain(
      'px-session=signed-cookie',
    )
  })

  it('returns 401 and does not create a cookie for invalid token', async () => {
    const signSubject = vi.fn()
    const handler = createSessionPostHandler({
      verifyAccessToken: async () => {
        throw new Error('invalid signature')
      },
      signSubject,
      cookieName: 'px-session',
      cookieMaxAge: 3600,
    })

    const response = await handler(jsonRequest({ accessToken: 'invalid' }))

    expect(response.status).toBe(401)
    expect(signSubject).not.toHaveBeenCalled()
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}
