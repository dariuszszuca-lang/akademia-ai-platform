import { z } from 'zod'
import { signIn as cognitoSignIn } from '../../src/lib/cognito'
import {
  safeDeletionReceiptSchema,
  type SafeDeletionReceipt,
} from '../../src/features/synthetic-acceptance/cleanup-registry'

const PRODUCTION_URL =
  'https://akademia-ai-platform.vercel.app'
const HTTP_TIMEOUT_MS = 30_000

const releaseUsernameSchema = z
  .string()
  .regex(
    /^synthetic-release-syn-\d{8}T\d{6}Z-[a-f0-9]{8}-[ab]@example\.invalid$/,
  )

type SignInResult = {
  AuthenticationResult?: {
    AccessToken: string
  }
}

type HttpCleanupRuntime = {
  signIn?: (
    username: string,
    password: string,
  ) => Promise<SignInResult>
  fetcher?: typeof fetch
}

export async function deleteSyntheticAccountByContract(
  input: {
    baseUrl: string
    username: string
    password: string
  },
  runtime: HttpCleanupRuntime = {},
): Promise<SafeDeletionReceipt> {
  try {
    validateBaseUrl(input.baseUrl)
    releaseUsernameSchema.parse(input.username)
    if (
      input.password.length < 20 ||
      input.password.length > 200
    ) {
      throw new Error('invalid password')
    }

    const signIn = runtime.signIn ?? cognitoSignIn
    const fetcher = runtime.fetcher ?? fetch
    const authentication = await signIn(
      input.username,
      input.password,
    )
    const accessToken =
      authentication.AuthenticationResult?.AccessToken
    if (!accessToken) throw new Error('missing access token')

    const sessionResponse = await fetcher(
      `${input.baseUrl}/api/auth/session`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accessToken }),
        redirect: 'error',
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      },
    )
    if (!sessionResponse.ok) throw new Error('session failed')
    const sessionCookie = extractCookie(
      sessionResponse.headers,
      'px-session',
    )

    const deletionResponse = await fetcher(
      `${input.baseUrl}/api/account/delete`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
          cookie: `px-session=${sessionCookie}`,
        },
        body: JSON.stringify({ confirm: 'DELETE' }),
        redirect: 'error',
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      },
    )
    if (!deletionResponse.ok) throw new Error('deletion failed')
    const body: unknown = await deletionResponse
      .json()
      .catch(() => null)
    const parsed = z
      .object({
        ok: z.literal(true),
        deleted: safeDeletionReceiptSchema.omit({ ok: true }),
      })
      .strict()
      .safeParse(body)
    if (!parsed.success) throw new Error('invalid receipt')

    return safeDeletionReceiptSchema.parse({
      ok: true,
      ...parsed.data.deleted,
    })
  } catch {
    throw new Error('CURRENT_RELEASE_ACCOUNT_CLEANUP_FAILED')
  }
}

export async function restoreAdminAgentByContract(
  input: {
    baseUrl: string
    adminPassword: string
    previousState: {
      agentId: string
      enabled: boolean
    }
  },
  runtime: Pick<HttpCleanupRuntime, 'fetcher'> = {},
): Promise<true> {
  let adminCookie: string | null = null
  let failed = false
  try {
    validateBaseUrl(input.baseUrl)
    const previousState = z
      .object({
        agentId: z.literal('publikacja'),
        enabled: z.boolean(),
      })
      .strict()
      .parse(input.previousState)
    if (
      input.adminPassword.length < 20 ||
      input.adminPassword.length > 200
    ) {
      throw new Error('invalid password')
    }
    const fetcher = runtime.fetcher ?? fetch
    const authResponse = await fetcher(
      `${input.baseUrl}/api/admin/auth`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          password: input.adminPassword,
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      },
    )
    if (!authResponse.ok) throw new Error('auth failed')
    adminCookie = extractCookie(
      authResponse.headers,
      'admin_session',
    )
    const headers = {
      cookie: `admin_session=${adminCookie}`,
    }

    const beforeResponse = await fetcher(
      `${input.baseUrl}/api/admin/agents`,
      {
        method: 'GET',
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      },
    )
    if (
      !beforeResponse.ok ||
      !findAgentState(
        await beforeResponse.json().catch(() => null),
        previousState.agentId,
      )
    ) {
      throw new Error('read failed')
    }

    const patchResponse = await fetcher(
      `${input.baseUrl}/api/admin/agents`,
      {
        method: 'PATCH',
        headers: {
          ...headers,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          id: previousState.agentId,
          enabled: previousState.enabled,
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      },
    )
    if (!patchResponse.ok) throw new Error('patch failed')

    const readbackResponse = await fetcher(
      `${input.baseUrl}/api/admin/agents`,
      {
        method: 'GET',
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      },
    )
    const readback = readbackResponse.ok
      ? findAgentState(
          await readbackResponse.json().catch(() => null),
          previousState.agentId,
        )
      : null
    if (
      !readback ||
      readback.enabled !== previousState.enabled
    ) {
      throw new Error('readback failed')
    }
  } catch {
    failed = true
  } finally {
    if (adminCookie !== null) {
      try {
        const fetcher = runtime.fetcher ?? fetch
        const logoutResponse = await fetcher(
          `${input.baseUrl}/api/admin/logout`,
          {
            method: 'POST',
            headers: {
              cookie: `admin_session=${adminCookie}`,
            },
            redirect: 'error',
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
          },
        )
        if (!logoutResponse.ok) failed = true
      } catch {
        failed = true
      }
    }
  }

  if (failed) {
    throw new Error('CURRENT_RELEASE_ADMIN_RESTORE_FAILED')
  }
  return true
}

function validateBaseUrl(value: string): void {
  if (value !== PRODUCTION_URL) {
    throw new Error('invalid base url')
  }
}

function extractCookie(
  headers: Headers,
  name: 'px-session' | 'admin_session',
): string {
  const setCookie = headers.get('set-cookie') ?? ''
  const match = setCookie.match(
    new RegExp(`(?:^|,\\s*)${name}=([^;,\\s]+)`),
  )
  if (!match?.[1]) throw new Error('cookie missing')
  return match[1]
}

function findAgentState(
  value: unknown,
  agentId: string,
): { id: string; enabled: boolean } | null {
  const parsed = z
    .object({
      agents: z.array(
        z
          .object({
            id: z.string(),
            enabled: z.boolean(),
          })
          .passthrough(),
      ),
    })
    .passthrough()
    .safeParse(value)
  if (!parsed.success) return null
  const matches = parsed.data.agents.filter(
    (agent) => agent.id === agentId,
  )
  return matches.length === 1 ? matches[0]! : null
}
