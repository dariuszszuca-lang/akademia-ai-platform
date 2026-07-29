import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  requireServerUserIdOrRedirect,
  signSession,
  verifySession,
} from './session'

const { mockedCookies, mockedRedirect } = vi.hoisted(() => ({
  mockedCookies: vi.fn(),
  mockedRedirect: vi.fn((path: string): never => {
    const error = new Error('NEXT_REDIRECT')
    Object.assign(error, {
      digest: `NEXT_REDIRECT;replace;${path};307;`,
    })
    throw error
  }),
}))

vi.mock('next/headers', () => ({
  cookies: mockedCookies,
}))

vi.mock('next/navigation', () => ({
  redirect: mockedRedirect,
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('signed server session', () => {
  it('round-trips a subject and rejects a modified cookie', () => {
    vi.stubEnv(
      'SESSION_SECRET',
      'test-only-session-secret-with-at-least-32-characters',
    )

    const signed = signSession('user-a')

    expect(verifySession(signed)).toBe('user-a')
    expect(verifySession(`${signed}modified`)).toBeNull()
  })

  it('does not use a hardcoded fallback secret', () => {
    vi.stubEnv('SESSION_SECRET', '')
    vi.stubEnv('ADMIN_SESSION_SECRET', '')
    vi.stubEnv('ADMIN_PASSWORD', '')

    expect(() => signSession('user-a')).toThrow('SESSION_SECRET_NOT_CONFIGURED')
  })

  it('redirects an unsigned server render to login', async () => {
    mockedCookies.mockResolvedValue({
      get: vi.fn(() => undefined),
    })

    await expect(requireServerUserIdOrRedirect()).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;replace;/login;307;',
    })
    expect(mockedRedirect).toHaveBeenCalledWith('/login')
  })

  it('returns the verified subject for an authenticated server render', async () => {
    vi.stubEnv(
      'SESSION_SECRET',
      'test-only-session-secret-with-at-least-32-characters',
    )
    mockedCookies.mockResolvedValue({
      get: vi.fn(() => ({ value: signSession('user-a') })),
    })

    await expect(requireServerUserIdOrRedirect()).resolves.toBe('user-a')
    expect(mockedRedirect).not.toHaveBeenCalled()
  })
})
