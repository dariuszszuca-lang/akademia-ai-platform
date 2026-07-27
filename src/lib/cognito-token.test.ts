import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createVerifier } = vi.hoisted(() => ({
  createVerifier: vi.fn(() => ({
    verify: vi.fn(async () => ({ sub: 'verified-user' })),
  })),
}))

vi.mock('server-only', () => ({}))
vi.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: createVerifier,
  },
}))

describe('Cognito access token verifier configuration', () => {
  beforeEach(() => {
    vi.resetModules()
    createVerifier.mockClear()
    vi.stubEnv('COGNITO_USER_POOL_ID', ' eu-central-1_example\n')
    vi.stubEnv('COGNITO_CLIENT_ID', ' client-id\n')
  })

  it('removes outer whitespace from Vercel environment values', async () => {
    const { verifyCognitoAccessToken } = await import('./cognito-token')

    await verifyCognitoAccessToken('access-token')

    expect(createVerifier).toHaveBeenCalledWith({
      userPoolId: 'eu-central-1_example',
      tokenUse: 'access',
      clientId: 'client-id',
    })
  })
})
