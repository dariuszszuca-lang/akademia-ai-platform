import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createAdminSessionToken,
  verifyAdminSessionToken,
  verifyPassword,
} from './admin-auth'

const originalAdminPassword = process.env.ADMIN_PASSWORD

describe('admin authentication helpers', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'synthetic-admin-password'
  })

  afterEach(() => {
    if (originalAdminPassword === undefined) {
      delete process.env.ADMIN_PASSWORD
    } else {
      process.env.ADMIN_PASSWORD = originalAdminPassword
    }
  })

  it('signs an opaque HMAC token and rejects modification', () => {
    const secret = 'synthetic-session-secret'
    const token = createAdminSessionToken(secret)

    expect(token).not.toContain(
      Buffer.from(`admin:${secret}`).toString('base64'),
    )
    expect(verifyAdminSessionToken(token, secret)).toBe(true)
    expect(verifyAdminSessionToken(`${token}x`, secret)).toBe(false)
  })

  it('rejects a session token signed with a different secret', () => {
    const token = createAdminSessionToken('first-synthetic-secret')

    expect(
      verifyAdminSessionToken(token, 'second-synthetic-secret'),
    ).toBe(false)
  })

  it.each(['', 'not-a-valid-token', '***'])(
    'rejects an empty or malformed token: %j',
    (token) => {
      expect(
        verifyAdminSessionToken(token, 'synthetic-session-secret'),
      ).toBe(false)
    },
  )

  it('accepts only the exact configured password', () => {
    expect(verifyPassword('synthetic-admin-password')).toBe(true)
    expect(verifyPassword('synthetic-admin-passwordx')).toBe(false)
    expect(verifyPassword('')).toBe(false)
  })

  it('fails closed when the admin password is not configured', () => {
    delete process.env.ADMIN_PASSWORD

    expect(verifyPassword('anything')).toBe(false)
  })
})
