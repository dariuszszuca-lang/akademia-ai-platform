import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextResponse } from 'next/server'
import {
  createAdminSessionToken,
  setSessionCookie,
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
    const token = createAdminSessionToken(
      'first-synthetic-secret',
      Date.UTC(2026, 6, 29, 10),
    )

    expect(
      verifyAdminSessionToken(
        token,
        'second-synthetic-secret',
        Date.UTC(2026, 6, 29, 11),
      ),
    ).toBe(false)
  })

  it('expires the signed session on the server after seven days', () => {
    const issuedAt = Date.UTC(2026, 6, 29, 10)
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    const secret = 'synthetic-session-secret'
    const token = createAdminSessionToken(secret, issuedAt)

    expect(
      verifyAdminSessionToken(
        token,
        secret,
        issuedAt + sevenDays - 1,
      ),
    ).toBe(true)
    expect(
      verifyAdminSessionToken(token, secret, issuedAt + sevenDays),
    ).toBe(false)
  })

  it('does not include the session secret in its signed payload', () => {
    const secret = 'synthetic-session-secret'
    const token = createAdminSessionToken(
      secret,
      Date.UTC(2026, 6, 29, 10),
    )
    const [payload] = token.split('.')
    const decoded = Buffer.from(payload, 'base64url').toString(
      'utf8',
    )

    expect(decoded).not.toContain(secret)
    expect(decoded).not.toContain('synthetic-admin-password')
  })

  it('rejects a noncanonical base64url representation of the same signature bits', () => {
    const secret = 'synthetic-session-secret'
    const token = createAdminSessionToken(
      secret,
      Date.UTC(2026, 6, 29, 10),
    )
    const [payload, signature] = token.split('.')
    const alphabet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    const finalIndex = alphabet.indexOf(signature.at(-1) ?? '')
    if (finalIndex < 0 || finalIndex % 4 !== 0) {
      throw new Error('Expected a canonical SHA-256 signature fixture')
    }
    const noncanonicalSignature =
      signature.slice(0, -1) + alphabet[finalIndex + 1]

    expect(
      Buffer.from(noncanonicalSignature, 'base64url'),
    ).toEqual(Buffer.from(signature, 'base64url'))
    expect(
      verifyAdminSessionToken(
        `${payload}.${noncanonicalSignature}`,
        secret,
        Date.UTC(2026, 6, 29, 11),
      ),
    ).toBe(false)
  })

  it('keeps the admin cookie lifetime aligned to seven days', () => {
    const response = setSessionCookie(
      NextResponse.json({ ok: true }),
    )
    const setCookie = response.headers.get('set-cookie')

    expect(setCookie).toContain('Max-Age=604800')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=strict')
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
