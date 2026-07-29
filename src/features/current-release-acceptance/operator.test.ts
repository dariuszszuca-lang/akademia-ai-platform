import { describe, expect, it, vi } from 'vitest'
import {
  assertCallerIdentity,
  createUser,
  deleteUser,
  readOperatorJson,
  type AwsCommandExecutor,
  type OperatorContext,
} from '../../../e2e/current-release/operator'

const runId = 'syn-20260729T220000Z-deadbeef'
const username = `synthetic-release-${runId}-a@example.invalid`

function context(
  overrides: Partial<OperatorContext> = {},
): OperatorContext {
  return {
    runId,
    profile: 'akademia-ai',
    region: 'eu-central-1',
    accountId: '261965598943',
    userPoolId: 'eu-central-1_synthetic',
    stackName: 'PropertySourceStorage-prod',
    bucketName: 'synthetic-release-bucket',
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

const validIdentity = JSON.stringify({
  Account: '261965598943',
  Arn: 'arn:aws:iam::261965598943:user/akademia-wojtka-admin-darek',
})

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

  it('validates identity before creating the current-run user and never interpolates a shell command', async () => {
    const executor = fakeExecutor([
      { ok: true, stdout: validIdentity },
      { ok: true, stdout: '{}' },
      { ok: true, stdout: '{}' },
    ])

    await createUser(
      context(),
      username,
      'Synthetic-user-A-password-123!',
      executor,
    )

    expect(executor.calls).toHaveLength(3)
    expect(executor.calls[0]!.slice(0, 2)).toEqual([
      'sts',
      'get-caller-identity',
    ])
    expect(executor.calls[1]).toContain('admin-create-user')
    expect(executor.calls[2]).toContain('admin-set-user-password')
    expect(executor.calls.flat()).toContain(username)
  })

  it('refuses a username outside the current run before any AWS call', async () => {
    const executor = fakeExecutor([])

    await expect(
      createUser(
        context(),
        'synthetic-release-syn-20260729T220000Z-feedface-a@example.invalid',
        'Synthetic-user-A-password-123!',
        executor,
      ),
    ).rejects.toThrow(`CURRENT_RELEASE_OPERATOR_USERNAME_INVALID:${runId}`)
    expect(executor.calls).toEqual([])
  })

  it('uses one attempt for create mutations and two only for idempotent delete', async () => {
    const createExecutor = fakeExecutor([
      { ok: true, stdout: validIdentity },
      { ok: false, errorKind: 'transient' },
    ])
    await expect(
      createUser(
        context(),
        username,
        'Synthetic-user-A-password-123!',
        createExecutor,
      ),
    ).rejects.toThrow(`CURRENT_RELEASE_OPERATOR_MUTATION_FAILED:${runId}`)
    expect(createExecutor.calls).toHaveLength(2)

    const deleteExecutor = fakeExecutor([
      { ok: true, stdout: validIdentity },
      { ok: false, errorKind: 'transient' },
      { ok: true, stdout: '{}' },
    ])
    await deleteUser(context(), username, deleteExecutor)
    expect(
      deleteExecutor.calls.filter((args) =>
        args.includes('admin-delete-user'),
      ),
    ).toHaveLength(2)
  })

  it('never leaks password or raw stderr through an operator error', async () => {
    const secret = 'Synthetic-user-A-password-123!'
    const executor = fakeExecutor([
      { ok: true, stdout: validIdentity },
      { ok: false, errorKind: 'failed' },
    ])

    let caught = ''
    try {
      await createUser(context(), username, secret, executor)
    } catch (error) {
      caught = error instanceof Error ? error.message : String(error)
    }
    expect(caught).toBe(
      `CURRENT_RELEASE_OPERATOR_MUTATION_FAILED:${runId}`,
    )
    expect(caught).not.toContain(secret)
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
