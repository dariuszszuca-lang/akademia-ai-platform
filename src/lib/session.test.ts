import { afterEach, describe, expect, it, vi } from 'vitest'
import { signSession, verifySession } from './session'

afterEach(() => {
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
})
