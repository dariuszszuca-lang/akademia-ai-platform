import { describe, expect, it } from 'vitest'
import {
  createLegalNoHitProbeNonce,
  signLegalNoHitProbe,
  verifyLegalNoHitProbe,
} from './legal-probe'

const acceptanceSecret = 's'.repeat(43)
const runId = 'syn-20260729T220000Z-deadbeef'
const userId = '11111111-1111-4111-8111-111111111111'
const nonce = 'n'.repeat(43)
const nowEpochSeconds = Math.floor(
  new Date('2026-07-29T22:00:00.000Z').getTime() / 1000,
)
const expiresAt = nowEpochSeconds + 30

describe('signed current release legal no-hit probe', () => {
  it('signs the exact run, subject, nonce and expiry deterministically', () => {
    const signature = signLegalNoHitProbe({
      acceptanceSecret,
      runId,
      userId,
      nonce,
      expiresAt,
    }, nowEpochSeconds)

    expect(signature).toMatch(/^[a-f0-9]{64}$/)
    expect(
      verifyLegalNoHitProbe({
        acceptanceSecret,
        runId,
        userId,
        nonce,
        expiresAt,
        signature,
      }, nowEpochSeconds),
    ).toBe(true)
    expect(
      signLegalNoHitProbe(
        {
          acceptanceSecret,
          runId,
          userId,
          nonce,
          expiresAt,
        },
        nowEpochSeconds,
      ),
    ).toBe(signature)
  })

  it('creates random high-entropy nonce values in the strict wire format', () => {
    const first = createLegalNoHitProbeNonce()
    const second = createLegalNoHitProbeNonce()

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(second).not.toBe(first)
  })

  it('rejects a foreign subject, run, secret or malformed signature without throwing', () => {
    const signature = signLegalNoHitProbe({
      acceptanceSecret,
      runId,
      userId,
      nonce,
      expiresAt,
    }, nowEpochSeconds)

    expect(
      verifyLegalNoHitProbe({
        acceptanceSecret,
        runId,
        userId: '22222222-2222-4222-8222-222222222222',
        nonce,
        expiresAt,
        signature,
      }, nowEpochSeconds),
    ).toBe(false)
    expect(
      verifyLegalNoHitProbe({
        acceptanceSecret,
        runId: 'syn-20260729T220000Z-feedface',
        userId,
        nonce,
        expiresAt,
        signature,
      }, nowEpochSeconds),
    ).toBe(false)
    expect(
      verifyLegalNoHitProbe({
        acceptanceSecret: 'w'.repeat(43),
        runId,
        userId,
        nonce,
        expiresAt,
        signature,
      }, nowEpochSeconds),
    ).toBe(false)
    expect(
      verifyLegalNoHitProbe({
        acceptanceSecret,
        runId,
        userId,
        nonce,
        expiresAt,
        signature: 'not-a-signature',
      }, nowEpochSeconds),
    ).toBe(false)
    expect(
      verifyLegalNoHitProbe({
        acceptanceSecret: undefined,
        runId,
        userId,
        nonce,
        expiresAt,
        signature,
      }, nowEpochSeconds),
    ).toBe(false)
  })

  it('rejects expired and too-far-future capabilities fail-closed', () => {
    const validSignature = signLegalNoHitProbe(
      {
        acceptanceSecret,
        runId,
        userId,
        nonce,
        expiresAt,
      },
      nowEpochSeconds,
    )

    expect(
      verifyLegalNoHitProbe(
        {
          acceptanceSecret,
          runId,
          userId,
          nonce,
          expiresAt,
          signature: validSignature,
        },
        expiresAt,
      ),
    ).toBe(false)
    expect(
      verifyLegalNoHitProbe(
        {
          acceptanceSecret,
          runId,
          userId,
          nonce,
          expiresAt,
          signature: validSignature,
        },
        nowEpochSeconds - 31,
      ),
    ).toBe(false)
  })

  it('fails closed on malformed nonce and invalid signer input with a stable secret-free error', () => {
    expect(() =>
      signLegalNoHitProbe(
        {
          acceptanceSecret,
          runId: '../unsafe-run',
          userId,
          nonce,
          expiresAt,
        },
        nowEpochSeconds,
      ),
    ).toThrow('CURRENT_RELEASE_LEGAL_PROBE_INVALID')
    expect(() =>
      signLegalNoHitProbe(
        {
          acceptanceSecret,
          runId,
          userId,
          nonce: 'short',
          expiresAt,
        },
        nowEpochSeconds,
      ),
    ).toThrow('CURRENT_RELEASE_LEGAL_PROBE_INVALID')
    expect(() =>
      signLegalNoHitProbe(
        {
          acceptanceSecret: '',
          runId,
          userId,
          nonce,
          expiresAt,
        },
        nowEpochSeconds,
      ),
    ).toThrow('CURRENT_RELEASE_LEGAL_PROBE_INVALID')
  })
})
