import { describe, expect, it } from 'vitest'
import {
  signLegalNoHitProbe,
  verifyLegalNoHitProbe,
} from './legal-probe'

const adminPassword = 'Synthetic-admin-password-123!'
const runId = 'syn-20260729T220000Z-deadbeef'
const userId = '11111111-1111-4111-8111-111111111111'

describe('signed current release legal no-hit probe', () => {
  it('signs the exact run and authenticated subject deterministically', () => {
    const signature = signLegalNoHitProbe({
      adminPassword,
      runId,
      userId,
    })

    expect(signature).toMatch(/^[a-f0-9]{64}$/)
    expect(
      verifyLegalNoHitProbe({
        adminPassword,
        runId,
        userId,
        signature,
      }),
    ).toBe(true)
    expect(
      signLegalNoHitProbe({ adminPassword, runId, userId }),
    ).toBe(signature)
  })

  it('rejects a foreign subject, run, key or malformed signature without throwing', () => {
    const signature = signLegalNoHitProbe({
      adminPassword,
      runId,
      userId,
    })

    expect(
      verifyLegalNoHitProbe({
        adminPassword,
        runId,
        userId: '22222222-2222-4222-8222-222222222222',
        signature,
      }),
    ).toBe(false)
    expect(
      verifyLegalNoHitProbe({
        adminPassword,
        runId: 'syn-20260729T220000Z-feedface',
        userId,
        signature,
      }),
    ).toBe(false)
    expect(
      verifyLegalNoHitProbe({
        adminPassword: 'Different-synthetic-password-456!',
        runId,
        userId,
        signature,
      }),
    ).toBe(false)
    expect(
      verifyLegalNoHitProbe({
        adminPassword,
        runId,
        userId,
        signature: 'not-a-signature',
      }),
    ).toBe(false)
    expect(
      verifyLegalNoHitProbe({
        adminPassword: undefined,
        runId,
        userId,
        signature,
      }),
    ).toBe(false)
  })

  it('fails closed on invalid signer input with a stable secret-free error', () => {
    expect(() =>
      signLegalNoHitProbe({
        adminPassword,
        runId: '../unsafe-run',
        userId,
      }),
    ).toThrow('CURRENT_RELEASE_LEGAL_PROBE_INVALID')
    expect(() =>
      signLegalNoHitProbe({
        adminPassword: '',
        runId,
        userId,
      }),
    ).toThrow('CURRENT_RELEASE_LEGAL_PROBE_INVALID')
  })
})
