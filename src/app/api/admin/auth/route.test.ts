import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

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

const originalAdminPassword = process.env.ADMIN_PASSWORD
const originalAdminSessionSecret = process.env.ADMIN_SESSION_SECRET

function loginRequest(password: string): Request {
  return new Request('https://example.test/api/admin/auth', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ' 203.0.113.10, 198.51.100.4 ',
    },
    body: JSON.stringify({ password }),
  })
}

describe('POST /api/admin/auth rate limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.values.clear()
    mocks.expiresAt.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-29T10:00:00.000Z'))
    process.env.ADMIN_PASSWORD = 'synthetic-admin-password'
    process.env.ADMIN_SESSION_SECRET = 'synthetic-session-secret'
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalAdminPassword === undefined) {
      delete process.env.ADMIN_PASSWORD
    } else {
      process.env.ADMIN_PASSWORD = originalAdminPassword
    }
    if (originalAdminSessionSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET
    } else {
      process.env.ADMIN_SESSION_SECRET = originalAdminSessionSecret
    }
  })

  it('returns 429 with Retry-After on the sixth failed attempt in 15 minutes', async () => {
    const { POST } = await import('./route')

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await POST(loginRequest('wrong-password'))

      expect(response.status).toBe(401)
    }

    const blocked = await POST(loginRequest('wrong-password'))

    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0)
    await expect(blocked.json()).resolves.toEqual({
      error: 'Too many attempts',
    })
    expect(
      [...mocks.values.keys()].some((key) =>
        key.includes('admin-auth:203.0.113.10:'),
      ),
    ).toBe(true)
  })

  it('atomically allows only five of six concurrent failed attempts', async () => {
    const { POST } = await import('./route')

    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        POST(loginRequest('wrong-password')),
      ),
    )

    expect(
      responses.filter((response) => response.status === 401),
    ).toHaveLength(5)
    expect(
      responses.filter((response) => response.status === 429),
    ).toHaveLength(1)
  })

  it('does not spend the failure budget on successful logins and clears prior failures', async () => {
    const { POST } = await import('./route')

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect(
        (await POST(loginRequest('wrong-password'))).status,
      ).toBe(401)
    }

    expect(
      (await POST(loginRequest('synthetic-admin-password'))).status,
    ).toBe(200)

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(
        (await POST(loginRequest('wrong-password'))).status,
      ).toBe(401)
    }
    expect(
      (await POST(loginRequest('wrong-password'))).status,
    ).toBe(429)
  })

  it('uses unknown when x-forwarded-for is absent', async () => {
    const { POST } = await import('./route')
    const request = new Request(
      'https://example.test/api/admin/auth',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'wrong-password' }),
      },
    )

    expect((await POST(request)).status).toBe(401)
    expect(
      [...mocks.values.keys()].some((key) =>
        key.includes('admin-auth:unknown:'),
      ),
    ).toBe(true)
  })
})
