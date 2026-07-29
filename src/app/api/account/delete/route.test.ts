import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getServerUserId: vi.fn(),
  verifyCognitoAccessToken: vi.fn(),
  deleteUser: vi.fn(),
  deleteAccountData: vi.fn(),
  getPropertyRepository: vi.fn(),
  getPropertySourceObjectPurger: vi.fn(),
  getPropertySourceRepository: vi.fn(),
  getStudioEventService: vi.fn(),
  storeDelete: vi.fn(),
}))

vi.mock('@/lib/session', () => ({
  getServerUserId: mocks.getServerUserId,
  SESSION_COOKIE: 'studio-session',
}))

vi.mock('@/lib/cognito-token', () => ({
  verifyCognitoAccessToken: mocks.verifyCognitoAccessToken,
}))

vi.mock('@/lib/cognito', () => ({
  deleteUser: mocks.deleteUser,
}))

vi.mock('@/features/properties/account-data', () => ({
  deleteAccountData: mocks.deleteAccountData,
}))

vi.mock('@/features/properties/server-repository', () => ({
  getPropertyRepository: mocks.getPropertyRepository,
}))

vi.mock('@/features/property-sources/server-repository', () => ({
  getPropertySourceObjectPurger: mocks.getPropertySourceObjectPurger,
  getPropertySourceRepository: mocks.getPropertySourceRepository,
}))

vi.mock('@/features/studio-events/server-repository', () => ({
  getStudioEventService: mocks.getStudioEventService,
}))

vi.mock('@/lib/store', () => ({
  storeDelete: mocks.storeDelete,
}))

describe('POST /api/account/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.getServerUserId.mockResolvedValue('user-a')
    mocks.verifyCognitoAccessToken.mockResolvedValue({ sub: 'user-a' })
    mocks.deleteUser.mockResolvedValue({})
    mocks.deleteAccountData.mockResolvedValue({
      sourceObjects: 1,
      propertyStudio: 1,
      accountKeys: 5,
    })
    mocks.getPropertyRepository.mockReturnValue({
      getOrCreatePersonalOrganization: vi.fn(),
      deleteForUser: vi.fn(),
    })
    mocks.getPropertySourceObjectPurger.mockReturnValue({
      purgeSources: vi.fn(),
    })
    mocks.getPropertySourceRepository.mockReturnValue({
      listSourcesForUser: vi.fn(),
    })
    mocks.getStudioEventService.mockReturnValue({
      record: vi.fn(),
    })
  })

  it('returns 401 without a signed application session', async () => {
    mocks.getServerUserId.mockResolvedValue(null)
    const { POST } = await import('./route')

    const response = await POST(deleteRequest('Bearer token'))

    expect(response.status).toBe(401)
    expect(mocks.verifyCognitoAccessToken).not.toHaveBeenCalled()
    expect(mocks.deleteAccountData).not.toHaveBeenCalled()
    expect(mocks.deleteUser).not.toHaveBeenCalled()
  })

  it.each([undefined, '', 'Basic token', 'Bearer', 'bearer token'])(
    'returns 401 for invalid Authorization value %s',
    async (authorization) => {
      const { POST } = await import('./route')

      const response = await POST(deleteRequest(authorization))

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toEqual({
        error: 'unauthorized',
      })
      expect(mocks.verifyCognitoAccessToken).not.toHaveBeenCalled()
      expect(mocks.deleteAccountData).not.toHaveBeenCalled()
      expect(mocks.deleteUser).not.toHaveBeenCalled()
    },
  )

  it('returns 401 when Cognito token verification fails', async () => {
    mocks.verifyCognitoAccessToken.mockRejectedValue(
      new Error('invalid signature'),
    )
    const { POST } = await import('./route')

    const response = await POST(deleteRequest('Bearer token'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'unauthorized',
    })
    expect(mocks.deleteAccountData).not.toHaveBeenCalled()
    expect(mocks.deleteUser).not.toHaveBeenCalled()
  })

  it('returns 403 when token subject differs from the signed session', async () => {
    mocks.verifyCognitoAccessToken.mockResolvedValue({ sub: 'user-b' })
    const { POST } = await import('./route')

    const response = await POST(deleteRequest('Bearer token'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'forbidden',
    })
    expect(mocks.deleteAccountData).not.toHaveBeenCalled()
    expect(mocks.deleteUser).not.toHaveBeenCalled()
  })

  it('deletes application data before the matching Cognito identity', async () => {
    const order: string[] = []
    mocks.deleteAccountData.mockImplementation(async () => {
      order.push('application')
      return {
        sourceObjects: 1,
        propertyStudio: 1,
        accountKeys: 5,
      }
    })
    mocks.deleteUser.mockImplementation(async () => {
      order.push('cognito')
      return {}
    })
    const { POST } = await import('./route')

    const response = await POST(deleteRequest('Bearer token'))

    expect(response.status).toBe(200)
    expect(order).toEqual(['application', 'cognito'])
    expect(mocks.verifyCognitoAccessToken).toHaveBeenCalledWith('token')
    expect(mocks.deleteUser).toHaveBeenCalledWith('token')
    expect(response.headers.get('set-cookie')).toContain(
      'studio-session=',
    )
    await expect(response.json()).resolves.toEqual({
      ok: true,
      deleted: {
        sourceObjects: 1,
        propertyStudio: 1,
        accountKeys: 5,
      },
    })
  })

  it.each(['application', 'cognito'])(
    'returns deletion_failed when %s deletion fails',
    async (stage) => {
      if (stage === 'application') {
        mocks.deleteAccountData.mockRejectedValue(
          new Error('database unavailable'),
        )
      } else {
        mocks.deleteUser.mockRejectedValue(
          new Error('cognito unavailable'),
        )
      }
      const { POST } = await import('./route')

      const response = await POST(deleteRequest('Bearer token'))

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({
        error: 'deletion_failed',
      })
      if (stage === 'application') {
        expect(mocks.deleteUser).not.toHaveBeenCalled()
      }
    },
  )
})

function deleteRequest(authorization?: string) {
  const headers = new Headers({
    'content-type': 'application/json',
  })
  if (authorization !== undefined) {
    headers.set('authorization', authorization)
  }

  return new Request('https://example.test/api/account/delete', {
    method: 'POST',
    headers,
    body: JSON.stringify({ confirm: 'DELETE' }),
  })
}
