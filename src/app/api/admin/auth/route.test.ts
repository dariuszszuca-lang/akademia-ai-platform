import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  storeGet: vi.fn(async (key: string) => mocks.values.get(key) ?? null),
  storeSet: vi.fn(async (key: string, value: unknown) => {
    mocks.values.set(key, value)
  }),
}))

vi.mock('@/lib/store', () => ({
  storeGet: mocks.storeGet,
  storeSet: mocks.storeSet,
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
