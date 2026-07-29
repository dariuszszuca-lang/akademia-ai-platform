import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { rateLimit } from './rate-limit'

const mocks = vi.hoisted(() => ({
  values: new Map<string, number>(),
  expiresAt: new Map<string, number>(),
  storeGet: vi.fn(async (key: string) => mocks.values.get(key) ?? null),
  storeIncrementWithExpiry: vi.fn(
    async (key: string, expiresAtEpochSeconds: number) => {
      const next = (mocks.values.get(key) ?? 0) + 1
      mocks.values.set(key, next)
      mocks.expiresAt.set(key, expiresAtEpochSeconds)
      return next
    },
  ),
  storeDelete: vi.fn(async (key: string) => {
    mocks.values.delete(key)
    mocks.expiresAt.delete(key)
  }),
}))

vi.mock('@/lib/store', () => ({
  storeGet: mocks.storeGet,
  storeIncrementWithExpiry: mocks.storeIncrementWithExpiry,
  storeDelete: mocks.storeDelete,
}))

describe('rateLimit atomic window counter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.values.clear()
    mocks.expiresAt.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-29T10:07:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows at most five of six concurrent attempts', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        rateLimit('admin-auth', '203.0.113.10', 5, 15),
      ),
    )

    expect(results.filter((result) => result.ok)).toHaveLength(5)
    expect(results.filter((result) => !result.ok)).toHaveLength(1)
    expect(mocks.storeIncrementWithExpiry).toHaveBeenCalledTimes(6)
  })

  it('expires the counter at the window end plus a five-second margin', async () => {
    await rateLimit('admin-auth', '203.0.113.10', 5, 15)

    const expectedExpiry = Math.floor(
      new Date('2026-07-29T10:15:05.000Z').getTime() / 1000,
    )
    expect(mocks.storeIncrementWithExpiry).toHaveBeenCalledWith(
      expect.stringContaining(
        'rate:admin-auth:203.0.113.10:',
      ),
      expectedExpiry,
    )
  })
})
