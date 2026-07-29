import { describe, expect, it, vi } from 'vitest'
import {
  assertCallerIdentity,
  readOperatorJson,
  type AwsCommandExecutor,
  type OperatorBaseContext,
} from '../../../e2e/current-release/operator'

const runId = 'syn-20260729T220000Z-deadbeef'

function context(
  overrides: Partial<OperatorBaseContext> = {},
): OperatorBaseContext {
  return {
    runId,
    profile: 'akademia-ai',
    region: 'eu-central-1',
    accountId: '261965598943',
    ...overrides,
  }
}

function fakeExecutor(
  responses: Array<{
    ok: boolean
    stdout?: string
    errorKind?: 'not-found' | 'transient' | 'failed'
  }>,
): AwsCommandExecutor & { calls: string[][] } {
  const calls: string[][] = []
  return {
    calls,
    execute: vi.fn(async (args) => {
      calls.push(args)
      const response = responses.shift()
      if (!response) throw new Error('unexpected fake call')
      return {
        ok: response.ok,
        stdout: response.stdout ?? '',
        errorKind: response.errorKind,
      }
    }),
  }
}

describe('current release AWS operator', () => {
  it('requires the exact account, region and IAM user', async () => {
    const executor = fakeExecutor([
      {
        ok: true,
        stdout: JSON.stringify({
          Account: '021655150975',
          Arn: 'arn:aws:iam::021655150975:user/akademia-wojtka-admin-darek',
        }),
      },
    ])

    await expect(
      assertCallerIdentity(context(), executor),
    ).rejects.toThrow(`CURRENT_RELEASE_OPERATOR_IDENTITY_INVALID:${runId}`)
  })

})

describe('bounded operator HTTP reads', () => {
  it('uses a 30 second abort signal and at most two attempts', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )

    await expect(
      readOperatorJson(
        'https://akademia-ai-platform.vercel.app/api/admin/status',
        fetcher,
      ),
    ).resolves.toEqual({ ok: true })
    expect(fetcher).toHaveBeenCalledTimes(2)
    for (const call of fetcher.mock.calls) {
      expect(call[1]?.method).toBe('GET')
      expect(call[1]?.signal).toBeInstanceOf(AbortSignal)
    }
  })
})
