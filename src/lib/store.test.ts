import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { storeIncrementWithExpiry } from './store'

const mocks = vi.hoisted(() => {
  const transaction = {
    incr: vi.fn(),
    expireat: vi.fn(),
    exec: vi.fn(),
  }
  transaction.incr.mockReturnValue(transaction)
  transaction.expireat.mockReturnValue(transaction)

  return {
    transaction,
    multi: vi.fn(() => transaction),
  }
})

vi.mock('@vercel/kv', () => ({
  kv: {
    multi: mocks.multi,
  },
}))

const originalKvUrl = process.env.KV_REST_API_URL
const originalKvToken = process.env.KV_REST_API_TOKEN

describe('storeIncrementWithExpiry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.incr.mockReturnValue(mocks.transaction)
    mocks.transaction.expireat.mockReturnValue(mocks.transaction)
    mocks.transaction.exec.mockResolvedValue([3, 1])
    process.env.KV_REST_API_URL = 'https://synthetic-kv.invalid'
    process.env.KV_REST_API_TOKEN = 'synthetic-token'
  })

  afterEach(() => {
    if (originalKvUrl === undefined) {
      delete process.env.KV_REST_API_URL
    } else {
      process.env.KV_REST_API_URL = originalKvUrl
    }
    if (originalKvToken === undefined) {
      delete process.env.KV_REST_API_TOKEN
    } else {
      process.env.KV_REST_API_TOKEN = originalKvToken
    }
  })

  it('increments and assigns absolute expiry in one KV transaction', async () => {
    const result = await storeIncrementWithExpiry(
      'rate:synthetic',
      1_785_318_905,
    )

    expect(result).toBe(3)
    expect(mocks.multi).toHaveBeenCalledOnce()
    expect(mocks.transaction.incr).toHaveBeenCalledWith(
      'rate:synthetic',
    )
    expect(mocks.transaction.expireat).toHaveBeenCalledWith(
      'rate:synthetic',
      1_785_318_905,
    )
    expect(mocks.transaction.exec).toHaveBeenCalledOnce()
  })
})
