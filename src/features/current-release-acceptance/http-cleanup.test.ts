import { describe, expect, it, vi } from 'vitest'
import {
  deleteSyntheticAccountByContract,
  restoreAdminAgentByContract,
} from '../../../e2e/current-release/http-cleanup'

const baseUrl = 'https://akademia-ai-platform.vercel.app'
const username =
  'synthetic-release-syn-20260729T220000Z-deadbeef-a@example.invalid'
const password = 'Synthetic-user-A-password-123!'
const accessToken = 'synthetic-access-token'
const sessionCookie = 'synthetic.session.cookie'

describe('authenticated account cleanup contract', () => {
  it('deletes through one authenticated application request and returns only the safe receipt', async () => {
    const calls: Array<{
      url: string
      init: RequestInit | undefined
    }> = []
    const fetcher = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        calls.push({ url, init })
        if (url.endsWith('/api/auth/session')) {
          return Response.json(
            { ok: true },
            {
              headers: {
                'set-cookie':
                  `px-session=${sessionCookie}; Path=/; HttpOnly; Secure`,
              },
            },
          )
        }
        return Response.json({
          ok: true,
          deleted: {
            sourceObjects: 2,
            propertyStudio: 1,
            accountKeys: 5,
          },
        })
      },
    )

    const receipt = await deleteSyntheticAccountByContract(
      { baseUrl, username, password },
      {
        signIn: vi.fn(async () => ({
          AuthenticationResult: {
            AccessToken: accessToken,
            IdToken: 'unused',
            RefreshToken: 'unused',
            ExpiresIn: 3600,
          },
        })),
        fetcher,
      },
    )

    expect(receipt).toEqual({
      ok: true,
      sourceObjects: 2,
      propertyStudio: 1,
      accountKeys: 5,
    })
    expect(calls.map((call) => call.url)).toEqual([
      `${baseUrl}/api/auth/session`,
      `${baseUrl}/api/account/delete`,
    ])
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({ accessToken }),
    )
    expect(calls[1]?.init?.headers).toMatchObject({
      authorization: `Bearer ${accessToken}`,
      cookie: `px-session=${sessionCookie}`,
    })
    expect(calls[1]?.init?.body).toBe(
      JSON.stringify({ confirm: 'DELETE' }),
    )
    expect(JSON.stringify(receipt)).not.toMatch(
      /token|cookie|password|session/i,
    )
  })

  it('never retries a failed mutation and maps all raw failures to a stable error', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { ok: true },
          {
            headers: {
              'set-cookie':
                `px-session=${sessionCookie}; Path=/; HttpOnly`,
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          { error: `failure ${password} ${accessToken}` },
          { status: 500 },
        ),
      )

    await expect(
      deleteSyntheticAccountByContract(
        { baseUrl, username, password },
        {
          signIn: async () => ({
            AuthenticationResult: {
              AccessToken: accessToken,
              IdToken: 'unused',
              RefreshToken: 'unused',
              ExpiresIn: 3600,
            },
          }),
          fetcher,
        },
      ),
    ).rejects.toThrow('CURRENT_RELEASE_ACCOUNT_CLEANUP_FAILED')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('rejects a malformed receipt instead of inventing cleanup evidence', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { ok: true },
          {
            headers: {
              'set-cookie':
                `px-session=${sessionCookie}; Path=/; HttpOnly`,
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          deleted: {
            sourceObjects: -1,
            propertyStudio: 1,
            accountKeys: 5,
            accessToken,
          },
        }),
      )

    await expect(
      deleteSyntheticAccountByContract(
        { baseUrl, username, password },
        {
          signIn: async () => ({
            AuthenticationResult: {
              AccessToken: accessToken,
              IdToken: 'unused',
              RefreshToken: 'unused',
              ExpiresIn: 3600,
            },
          }),
          fetcher,
        },
      ),
    ).rejects.toThrow('CURRENT_RELEASE_ACCOUNT_CLEANUP_FAILED')
  })
})

describe('administrator restoration contract', () => {
  it('patches the original value, verifies exact readback and logs out', async () => {
    const calls: Array<{
      url: string
      method: string
      body?: BodyInit | null
    }> = []
    const fetcher = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        calls.push({ url, method, body: init?.body })
        if (url.endsWith('/api/admin/auth')) {
          return Response.json(
            { ok: true },
            {
              headers: {
                'set-cookie':
                  'admin_session=synthetic.admin.cookie; Path=/; HttpOnly',
              },
            },
          )
        }
        if (method === 'PATCH') {
          return Response.json({ ok: true })
        }
        if (url.endsWith('/api/admin/logout')) {
          return Response.json({ ok: true })
        }
        const isReadback = calls.filter(
          (call) =>
            call.url.endsWith('/api/admin/agents') &&
            call.method === 'GET',
        ).length === 2
        return Response.json({
          agents: [
            {
              id: 'publikacja',
              enabled: isReadback,
            },
          ],
          kv: { configured: true },
        })
      },
    )

    await expect(
      restoreAdminAgentByContract(
        {
          baseUrl,
          adminPassword: password,
          previousState: {
            agentId: 'publikacja',
            enabled: true,
          },
        },
        { fetcher },
      ),
    ).resolves.toBe(true)

    expect(
      calls.map((call) => [
        call.method,
        call.url.replace(baseUrl, ''),
      ]),
    ).toEqual([
      ['POST', '/api/admin/auth'],
      ['GET', '/api/admin/agents'],
      ['PATCH', '/api/admin/agents'],
      ['GET', '/api/admin/agents'],
      ['POST', '/api/admin/logout'],
    ])
    expect(calls[2]?.body).toBe(
      JSON.stringify({ id: 'publikacja', enabled: true }),
    )
  })

  it('logs out after a failed patch and returns no secret-bearing error', async () => {
    const urls: string[] = []
    const fetcher = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        urls.push(url)
        if (url.endsWith('/api/admin/auth')) {
          return Response.json(
            { ok: true },
            {
              headers: {
                'set-cookie':
                  'admin_session=synthetic.admin.cookie; Path=/; HttpOnly',
              },
            },
          )
        }
        if (
          url.endsWith('/api/admin/agents') &&
          (init?.method ?? 'GET') === 'GET'
        ) {
          return Response.json({
            agents: [{ id: 'publikacja', enabled: false }],
            kv: { configured: true },
          })
        }
        if (url.endsWith('/api/admin/logout')) {
          return Response.json({ ok: true })
        }
        return Response.json(
          { error: `failure ${password}` },
          { status: 500 },
        )
      },
    )

    await expect(
      restoreAdminAgentByContract(
        {
          baseUrl,
          adminPassword: password,
          previousState: {
            agentId: 'publikacja',
            enabled: true,
          },
        },
        { fetcher },
      ),
    ).rejects.toThrow('CURRENT_RELEASE_ADMIN_RESTORE_FAILED')
    expect(urls.at(-1)).toBe(`${baseUrl}/api/admin/logout`)
  })
})
