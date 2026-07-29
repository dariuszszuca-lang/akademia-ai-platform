import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Cognito account identity deletion', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the access token only to the Cognito DeleteUser action', async () => {
    const request = vi.fn<
      (
        input: string | URL | Request,
        init?: RequestInit,
      ) => Promise<Response>
    >(async () => Response.json({}, { status: 200 }))
    vi.stubGlobal('fetch', request)
    const { deleteUser } = await import('./cognito')

    await deleteUser('synthetic-access-token')

    expect(request).toHaveBeenCalledOnce()
    const [url, init] = request.mock.calls[0]
    expect(init).toBeDefined()
    if (!init) throw new Error('Missing Cognito request options')
    expect(url).toContain('cognito-idp.eu-central-1.amazonaws.com')
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target':
          'AWSCognitoIdentityProviderService.DeleteUser',
      },
    })
    expect(JSON.parse(String(init.body))).toEqual({
      AccessToken: 'synthetic-access-token',
    })
  })
})
