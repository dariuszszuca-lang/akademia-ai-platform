import { describe, expect, it, vi } from 'vitest'
import { consumeLegalNoHitProbeNonce } from './legal-probe-replay'

const input = {
  runId: 'syn-20260729T220000Z-deadbeef',
  userId: 'b3e4d882-2071-700e-4b23-0551e29214b6',
  nonce: 'n'.repeat(43),
  expiresAt: 1_785_362_430,
}
const nowEpochSeconds = 1_785_362_400

describe('legal no-hit capability replay guard', () => {
  it('atomically accepts only the first use and stores only a digest key', async () => {
    const increment = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)

    await expect(
      consumeLegalNoHitProbeNonce(
        input,
        increment,
        nowEpochSeconds,
      ),
    ).resolves.toBe(true)
    await expect(
      consumeLegalNoHitProbeNonce(
        input,
        increment,
        nowEpochSeconds,
      ),
    ).resolves.toBe(false)

    const [key, expiresAt] = increment.mock.calls[0]!
    expect(key).toMatch(
      /^current-release:legal-no-hit:[a-f0-9]{64}$/,
    )
    expect(key).not.toContain(input.runId)
    expect(key).not.toContain(input.userId)
    expect(key).not.toContain(input.nonce)
    expect(expiresAt).toBe(input.expiresAt)
  })

  it('rejects malformed or expired input before touching the store', async () => {
    const increment = vi.fn()

    await expect(
      consumeLegalNoHitProbeNonce(
        { ...input, nonce: 'short' },
        increment,
        nowEpochSeconds,
      ),
    ).resolves.toBe(false)
    await expect(
      consumeLegalNoHitProbeNonce(
        { ...input, expiresAt: nowEpochSeconds },
        increment,
        nowEpochSeconds,
      ),
    ).resolves.toBe(false)

    expect(increment).not.toHaveBeenCalled()
  })
})
