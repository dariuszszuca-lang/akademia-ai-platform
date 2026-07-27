import { describe, expect, it } from 'vitest'
import {
  createCallbackSignature,
  verifyCallbackRequest,
} from './callback-auth'

const secret = 'x'.repeat(32)
const timestamp = '1760000000'
const nonce = 'nonce_12345678901234567890123456'
const body = new TextEncoder().encode('{"jobId":"demo"}')
const now = new Date(Number(timestamp) * 1000)

describe('property source callback authentication', () => {
  it('signs the exact timestamp, nonce and raw-body hash', () => {
    expect(
      createCallbackSignature({ secret, timestamp, nonce, body }),
    ).toBe(
      '805baed1a5ae0c6e4f9081643676e15d5a0ab3c872a2b6455d7a7b989e7ff507',
    )
  })

  it('accepts one correctly signed request within the time window', () => {
    const signature = createCallbackSignature({
      secret,
      timestamp,
      nonce,
      body,
    })

    expect(
      verifyCallbackRequest({
        secret,
        timestamp,
        nonce,
        signature,
        body,
        now,
      }),
    ).toEqual({
      timestampSeconds: Number(timestamp),
      nonce,
      bodySha256:
        '82490d0b96d0b0b17980ff2e9da1b78997e14fd7b9f73c006b57d97bff184645',
    })
  })

  it('rejects a signature for a different raw body', () => {
    const signature = createCallbackSignature({
      secret,
      timestamp,
      nonce,
      body,
    })

    expect(() =>
      verifyCallbackRequest({
        secret,
        timestamp,
        nonce,
        signature,
        body: new TextEncoder().encode('{"jobId":"changed"}'),
        now,
      }),
    ).toThrow('CALLBACK_AUTH_INVALID')
  })

  it('rejects stale and future timestamps', () => {
    const signature = createCallbackSignature({
      secret,
      timestamp,
      nonce,
      body,
    })

    expect(() =>
      verifyCallbackRequest({
        secret,
        timestamp,
        nonce,
        signature,
        body,
        now: new Date((Number(timestamp) + 301) * 1000),
      }),
    ).toThrow('CALLBACK_AUTH_STALE')
    expect(() =>
      verifyCallbackRequest({
        secret,
        timestamp: String(Number(timestamp) + 31),
        nonce,
        signature: createCallbackSignature({
          secret,
          timestamp: String(Number(timestamp) + 31),
          nonce,
          body,
        }),
        body,
        now,
      }),
    ).toThrow('CALLBACK_AUTH_FUTURE')
  })

  it.each([
    { timestamp: '', nonce, signature: 'a'.repeat(64) },
    { timestamp, nonce: 'short', signature: 'a'.repeat(64) },
    { timestamp, nonce, signature: 'not-hex' },
    { timestamp: '1.5', nonce, signature: 'a'.repeat(64) },
  ])('rejects malformed authentication input: %j', (headers) => {
    expect(() =>
      verifyCallbackRequest({
        secret,
        ...headers,
        body,
        now,
      }),
    ).toThrow(/^CALLBACK_/)
  })

  it('never returns the secret, body or signature in an error', () => {
    const signature = 'f'.repeat(64)

    try {
      verifyCallbackRequest({
        secret,
        timestamp,
        nonce,
        signature,
        body,
        now,
      })
      throw new Error('Expected verification to fail')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      expect(message).toBe('CALLBACK_AUTH_INVALID')
      expect(message).not.toContain(secret)
      expect(message).not.toContain(signature)
      expect(message).not.toContain('jobId')
    }
  })
})
