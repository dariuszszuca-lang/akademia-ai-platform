import { describe, expect, it, vi } from 'vitest'
import {
  cleanupCurrentRelease,
  waitForEphemeralStateExpiry,
  type CurrentReleaseCleanupDependencies,
  type CurrentReleaseCleanupInput,
} from './cleanup'
import {
  createSyntheticCleanupRegistry,
  type SyntheticCleanupRegistry,
} from '../synthetic-acceptance/cleanup-registry'

const runId = 'syn-20260729T220000Z-deadbeef'
const subjectA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const subjectB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function cleanupInput(): CurrentReleaseCleanupInput {
  const registry = createSyntheticCleanupRegistry({
    runId,
    startedAt: '2026-07-29T22:00:00.000Z',
  })
  registry.releaseUsers = [
    {
      role: 'a',
      username: `synthetic-release-${runId}-a@example.invalid`,
      cognitoSub: subjectA,
    },
    {
      role: 'b',
      username: `synthetic-release-${runId}-b@example.invalid`,
      cognitoSub: subjectB,
    },
  ]
  registry.kvKeys = [subjectA, subjectB].flatMap((subject) =>
    [
      'profil',
      'persona-buyer',
      'persona-seller',
      'onboarding',
      'subscription',
    ].map((suffix) => `user:${subject}:${suffix}`),
  )
  registry.accountDeletionReceipts = [
    {
      role: 'a',
      ok: true,
      sourceObjects: 1,
      propertyStudio: 1,
      accountKeys: 5,
    },
    {
      role: 'b',
      ok: true,
      sourceObjects: 0,
      propertyStudio: 1,
      accountKeys: 5,
    },
  ]
  registry.organizationId =
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  registry.organizationPrefix =
    'originals/organizations/cccccccc-cccc-4ccc-8ccc-cccccccccccc/'
  registry.storageKeys = [
    `${registry.organizationPrefix}source.pdf`,
  ]
  registry.adminAgentState = {
    agentId: 'publikacja',
    enabled: true,
  }
  registry.ephemeralStateExpiresAt = 1_785_362_465

  return {
    registry,
    baseUrl: 'https://akademia-ai-platform.vercel.app',
    adminPassword: 'Synthetic-admin-password-123!',
    credentials: [
      {
        role: 'a',
        username: registry.releaseUsers[0]!.username,
        password: 'Synthetic-user-A-password-123!',
      },
      {
        role: 'b',
        username: registry.releaseUsers[1]!.username,
        password: 'Synthetic-user-B-password-456!',
      },
    ],
  }
}

function dependencies(
  overrides: Partial<CurrentReleaseCleanupDependencies> = {},
): CurrentReleaseCleanupDependencies {
  return {
    assertIdentity: vi.fn(async () => undefined),
    getUserSubject: vi.fn(async () => null),
    deleteAccount: vi.fn(async () => ({
      ok: true,
      sourceObjects: 0,
      propertyStudio: 1,
      accountKeys: 5,
    }) as const),
    deleteIdentity: vi.fn(async () => undefined),
    persistRegistry: vi.fn(async () => undefined),
    restoreAdmin: vi.fn(async () => true),
    verifyS3Empty: vi.fn(async () => 0),
    checkDlq: vi.fn(async () => 0),
    checkAlarms: vi.fn(async () => 0),
    waitUntilEpochSeconds: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('current release real cleanup', () => {
  it('uses receipts as DB/KV proof, verifies S3/admin and waits for ephemeral TTL', async () => {
    const input = cleanupInput()
    const deps = dependencies()

    await expect(
      cleanupCurrentRelease(input, deps),
    ).resolves.toEqual({
      databaseEmpty: true,
      cognitoUsersAbsent: true,
      kvKeysAbsent: true,
      s3VersionsRemaining: 0,
      adminStateRestored: true,
      dlqMessagesVisible: 0,
      alarmsNotOk: 0,
    })

    expect(deps.deleteAccount).not.toHaveBeenCalled()
    expect(deps.deleteIdentity).not.toHaveBeenCalled()
    expect(deps.verifyS3Empty).toHaveBeenCalledWith({
      organizationPrefix: input.registry.organizationPrefix,
      storageKeys: input.registry.storageKeys,
    })
    expect(deps.restoreAdmin).toHaveBeenCalledWith({
      baseUrl: input.baseUrl,
      adminPassword: input.adminPassword,
      previousState: input.registry.adminAgentState,
    })
    expect(deps.waitUntilEpochSeconds).toHaveBeenCalledWith(
      input.registry.ephemeralStateExpiresAt,
    )
    expect(
      vi.mocked(deps.getUserSubject).mock.calls.map(
        ([username]) => username,
      ),
    ).toEqual([
      input.registry.releaseUsers[1]!.username,
      input.registry.releaseUsers[1]!.username,
      input.registry.releaseUsers[0]!.username,
      input.registry.releaseUsers[0]!.username,
    ])
  })

  it('persists an application receipt before using the idempotent identity fallback', async () => {
    const input = cleanupInput()
    input.registry.accountDeletionReceipts =
      input.registry.accountDeletionReceipts.filter(
        (receipt) => receipt.role === 'b',
      )
    const events: string[] = []
    let readsA = 0
    const deps = dependencies({
      getUserSubject: vi.fn(async (username) => {
        if (username.endsWith('-b@example.invalid')) return null
        readsA += 1
        return readsA < 3 ? subjectA : null
      }),
      assertIdentity: vi.fn(async () => {
        events.push('identity')
      }),
      deleteAccount: vi.fn(async ({ role }) => {
        events.push(`account:${role}`)
        return {
          ok: true,
          sourceObjects: 2,
          propertyStudio: 1,
          accountKeys: 5,
        } as const
      }),
      persistRegistry: vi.fn(
        async (registry: SyntheticCleanupRegistry) => {
        expect(
          registry.accountDeletionReceipts.some(
            (receipt) => receipt.role === 'a',
          ),
        ).toBe(true)
        events.push('persist')
        },
      ),
      deleteIdentity: vi.fn(async () => {
        events.push('identity-delete')
      }),
    })

    const result = await cleanupCurrentRelease(input, deps)

    expect(result.databaseEmpty).toBe(true)
    expect(result.cognitoUsersAbsent).toBe(true)
    expect(deps.deleteAccount).toHaveBeenCalledTimes(1)
    expect(deps.deleteIdentity).toHaveBeenCalledTimes(1)
    expect(events.indexOf('persist')).toBeLessThan(
      events.indexOf('identity-delete'),
    )
    expect(events.filter((event) => event === 'identity')).toHaveLength(
      3,
    )
  })

  it('fails closed for DB/KV proof when Cognito is absent without a receipt', async () => {
    const input = cleanupInput()
    input.registry.accountDeletionReceipts =
      input.registry.accountDeletionReceipts.filter(
        (receipt) => receipt.role === 'b',
      )
    const deps = dependencies()

    const result = await cleanupCurrentRelease(input, deps)

    expect(result.databaseEmpty).toBe(false)
    expect(result.kvKeysAbsent).toBe(false)
    expect(result.cognitoUsersAbsent).toBe(true)
    expect(deps.deleteAccount).not.toHaveBeenCalled()
    expect(deps.deleteIdentity).not.toHaveBeenCalled()
  })

  it('fails closed for KV proof when ephemeral expiry evidence is missing', async () => {
    const input = cleanupInput()
    input.registry.ephemeralStateExpiresAt = null
    const deps = dependencies()

    const result = await cleanupCurrentRelease(input, deps)

    expect(result.databaseEmpty).toBe(true)
    expect(result.kvKeysAbsent).toBe(false)
    expect(deps.waitUntilEpochSeconds).not.toHaveBeenCalled()
  })

  it('recovers idempotently from a crash without repeating application deletion', async () => {
    const input = cleanupInput()
    input.registry.accountDeletionReceipts =
      input.registry.accountDeletionReceipts.filter(
        (receipt) => receipt.role === 'b',
      )
    let userAExists = true
    const deps = dependencies({
      getUserSubject: vi.fn(async (username) =>
        username.endsWith('-a@example.invalid') && userAExists
          ? subjectA
          : null,
      ),
      deleteAccount: vi.fn(async () => {
        userAExists = false
        return {
          ok: true,
          sourceObjects: 0,
          propertyStudio: 1,
          accountKeys: 5,
        } as const
      }),
    })

    await cleanupCurrentRelease(input, deps)
    await cleanupCurrentRelease(input, deps)

    expect(deps.deleteAccount).toHaveBeenCalledTimes(1)
    expect(deps.deleteIdentity).not.toHaveBeenCalled()
    expect(input.registry.accountDeletionReceipts).toHaveLength(2)
  })

  it('returns truthful DLQ and alarm residue instead of hiding it', async () => {
    const result = await cleanupCurrentRelease(
      cleanupInput(),
      dependencies({
        checkDlq: vi.fn(async () => 2),
        checkAlarms: vi.fn(async () => 1),
      }),
    )

    expect(result.dlqMessagesVisible).toBe(2)
    expect(result.alarmsNotOk).toBe(1)
  })

  it('attempts every independent cleanup phase after account deletion failures and reports ordered phases', async () => {
    const input = cleanupInput()
    input.registry.accountDeletionReceipts = []
    const userExists = new Map([
      [input.registry.releaseUsers[0]!.username, true],
      [input.registry.releaseUsers[1]!.username, true],
    ])
    const events: string[] = []
    const deps = dependencies({
      getUserSubject: vi.fn(async (username) =>
        userExists.get(username)
          ? username.endsWith('-a@example.invalid')
            ? subjectA
            : subjectB
          : null,
      ),
      deleteAccount: vi.fn(async ({ role, username }) => {
        events.push(`account-${role}`)
        if (role === 'b') {
          throw new Error('raw secret-bearing failure')
        }
        userExists.set(username, false)
        return {
          ok: true,
          sourceObjects: 1,
          propertyStudio: 1,
          accountKeys: 5,
        } as const
      }),
      restoreAdmin: vi.fn(async () => {
        events.push('admin')
        throw new Error('admin failed')
      }),
      verifyS3Empty: vi.fn(async () => {
        events.push('s3')
        return 0
      }),
      waitUntilEpochSeconds: vi.fn(async () => {
        events.push('ttl')
      }),
      checkDlq: vi.fn(async () => {
        events.push('dlq')
        return 0
      }),
      checkAlarms: vi.fn(async () => {
        events.push('alarms')
        return 0
      }),
    })

    await expect(
      cleanupCurrentRelease(input, deps),
    ).rejects.toThrow(
      'CURRENT_RELEASE_CLEANUP_FAILED:ACCOUNT_B:ADMIN',
    )

    expect(events).toEqual([
      'account-b',
      'account-a',
      's3',
      'admin',
      'ttl',
      'dlq',
      'alarms',
    ])
    expect(input.registry.accountDeletionReceipts).toEqual([
      expect.objectContaining({ role: 'a', ok: true }),
    ])
  })

  it('maps secret-bearing dependency failures to one stable code', async () => {
    const secret = 'Synthetic-user-A-password-123!'

    await expect(
      cleanupCurrentRelease(
        cleanupInput(),
        dependencies({
          restoreAdmin: vi.fn(async () => {
            throw new Error(`raw ${secret}`)
          }),
        }),
      ),
    ).rejects.toThrow('CURRENT_RELEASE_CLEANUP_FAILED')
  })

  it('waits only for a bounded ephemeral TTL and verifies time advanced', async () => {
    let nowMs = 1_000_000
    const sleep = vi.fn(async (milliseconds: number) => {
      nowMs += milliseconds
    })

    await waitForEphemeralStateExpiry(1_005, {
      nowMs: () => nowMs,
      sleep,
    })

    expect(sleep).toHaveBeenCalledWith(5_000)
    await expect(
      waitForEphemeralStateExpiry(1_076, {
        nowMs: () => nowMs,
        sleep,
      }),
    ).rejects.toThrow(
      'CURRENT_RELEASE_EPHEMERAL_EXPIRY_INVALID',
    )
  })
})
