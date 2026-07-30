import {
  mkdtemp,
  readFile,
  rm,
  stat,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createSyntheticCleanupRegistry,
  parseSyntheticCleanupRegistry,
  removeSyntheticCleanupRegistry,
  saveSyntheticCleanupRegistry,
} from './cleanup-registry'

describe('synthetic cleanup registry', () => {
  it('keeps empty full-release fields backward compatible by default', () => {
    const registry = createSyntheticCleanupRegistry({
      runId: 'syn-20260728T210000Z-deadbeef',
      startedAt: '2026-07-28T21:00:00.000Z',
    })

    expect(registry.releaseUsers).toEqual([])
    expect(registry.kvKeys).toEqual([])
    expect(registry.adminAgentState).toBeNull()
    expect(registry.factIds).toEqual([])
    expect(registry.sourceJobIds).toEqual([])
    expect(registry.proposalIds).toEqual([])
    expect(registry.accountDeletionReceipts).toEqual([])
    expect(registry.ephemeralStateExpiresAt).toBeNull()
  })

  it('stores only bounded current-run identifiers with mode 0600', async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), 'studio-cleanup-registry-'),
    )
    const registry = createSyntheticCleanupRegistry({
      runId: 'syn-20260728T210000Z-deadbeef',
      startedAt: '2026-07-28T21:00:00.000Z',
    })
    registry.cognitoSub = '55555555-5555-4555-8555-555555555555'
    registry.organizationId = '11111111-1111-4111-8111-111111111111'
    registry.organizationPrefix =
      'originals/organizations/11111111-1111-4111-8111-111111111111/'
    registry.projectIds.push('22222222-2222-4222-8222-222222222222')
    registry.sourceIds.push('33333333-3333-4333-8333-333333333333')
    registry.storageKeys.push(
      `${registry.organizationPrefix}properties/22222222-2222-4222-8222-222222222222/sources/33333333-3333-4333-8333-333333333333/original`,
    )

    try {
      const path = await saveSyntheticCleanupRegistry(
        workspaceRoot,
        registry,
      )
      const serialized = await readFile(path, 'utf8')
      const file = await stat(path)

      expect(file.mode & 0o777).toBe(0o600)
      expect(JSON.parse(serialized)).toEqual(registry)
      expect(serialized).not.toMatch(/password|accessToken|cookie|secret/i)

      await removeSyntheticCleanupRegistry(workspaceRoot, registry.runId)
      await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })

  it('rejects a username or organization prefix outside the current run', () => {
    const registry = createSyntheticCleanupRegistry({
      runId: 'syn-20260728T210000Z-deadbeef',
      startedAt: '2026-07-28T21:00:00.000Z',
    })

    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', {
        ...registry,
        username: 'other@example.invalid',
      }),
    ).toThrow('SYNTHETIC_CLEANUP_USERNAME_INVALID')
    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', {
        ...registry,
        organizationId: '11111111-1111-4111-8111-111111111111',
        organizationPrefix: 'originals/organizations/shared/',
      }),
    ).toThrow('SYNTHETIC_CLEANUP_PREFIX_INVALID')
  })

  it('accepts the current UUID-shaped Cognito subject format', async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), 'studio-cleanup-registry-cognito-'),
    )
    const registry = createSyntheticCleanupRegistry({
      runId: 'syn-20260728T210000Z-feedface',
      startedAt: '2026-07-28T21:00:00.000Z',
    })
    registry.cognitoSub = '55555555-5555-7555-2555-555555555555'

    try {
      await expect(
        saveSyntheticCleanupRegistry(workspaceRoot, registry),
      ).resolves.toContain(`${registry.runId}.run.json`)
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })

  it('stores two exact release users, scoped KV keys and admin state', async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), 'studio-cleanup-registry-release-'),
    )
    const registry = createSyntheticCleanupRegistry({
      runId: 'syn-20260728T210000Z-cafebabe',
      startedAt: '2026-07-28T21:00:00.000Z',
    })
    const subjectA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const subjectB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    registry.releaseUsers.push(
      {
        role: 'a',
        username:
          `synthetic-release-${registry.runId}-a@example.invalid`,
        cognitoSub: subjectA,
      },
      {
        role: 'b',
        username:
          `synthetic-release-${registry.runId}-b@example.invalid`,
        cognitoSub: subjectB,
      },
    )
    registry.kvKeys.push(
      `user:${subjectA}:profil`,
      `user:${subjectA}:persona-buyer`,
      `user:${subjectB}:onboarding`,
      `user:${subjectB}:subscription`,
    )
    registry.adminAgentState = {
      agentId: 'publikacja',
      enabled: true,
    }
    registry.factIds.push(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    )
    registry.sourceJobIds.push(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    )
    registry.proposalIds.push(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    )
    registry.accountDeletionReceipts.push({
      role: 'a',
      ok: true,
      sourceObjects: 3,
      propertyStudio: 1,
      accountKeys: 5,
    })
    registry.ephemeralStateExpiresAt = 1_785_272_465

    try {
      const path = await saveSyntheticCleanupRegistry(
        workspaceRoot,
        registry,
      )
      await expect(
        readFile(path, 'utf8').then((value) => JSON.parse(value)),
      ).resolves.toEqual(registry)
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })

  it('parses legacy registries with empty full-release defaults', async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), 'studio-cleanup-registry-legacy-'),
    )
    const legacyRegistry = {
      runId: 'syn-20260728T210000Z-facefeed',
      username:
        'synthetic-acceptance-syn-20260728T210000Z-facefeed@example.invalid',
      cognitoSub: null,
      organizationId: null,
      organizationPrefix: null,
      projectIds: [],
      sourceIds: [],
      storageKeys: [],
      startedAt: '2026-07-28T21:00:00.000Z',
    }

    try {
      const path = await saveSyntheticCleanupRegistry(
        workspaceRoot,
        legacyRegistry as unknown as ReturnType<
          typeof createSyntheticCleanupRegistry
        >,
      )
      const saved = JSON.parse(await readFile(path, 'utf8'))

      expect(saved.releaseUsers).toEqual([])
      expect(saved.kvKeys).toEqual([])
      expect(saved.adminAgentState).toBeNull()
      expect(saved.factIds).toEqual([])
      expect(saved.sourceJobIds).toEqual([])
      expect(saved.proposalIds).toEqual([])
      expect(saved.accountDeletionReceipts).toEqual([])
      expect(saved.ephemeralStateExpiresAt).toBeNull()
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })

  it('rejects mismatched or duplicate release user roles', () => {
    const registry = createSyntheticCleanupRegistry({
      runId: 'syn-20260728T210000Z-deadbeef',
      startedAt: '2026-07-28T21:00:00.000Z',
    })
    const subjectA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    registry.releaseUsers.push({
      role: 'a',
      username:
        `synthetic-release-${registry.runId}-b@example.invalid`,
      cognitoSub: subjectA,
    })

    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', registry),
    ).toThrow('SYNTHETIC_RELEASE_USERNAME_INVALID')

    registry.releaseUsers[0]!.username =
      `synthetic-release-${registry.runId}-a@example.invalid`
    registry.releaseUsers.push({
      role: 'a',
      username:
        `synthetic-release-${registry.runId}-a@example.invalid`,
      cognitoSub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    })

    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', registry),
    ).toThrow('SYNTHETIC_RELEASE_ROLE_DUPLICATE')
  })

  it.each([
    'user:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:profil',
    'user:prefix-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:profil',
    'user:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-suffix:profil',
    'user:unknown:profil-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  ])('rejects an unknown or substring-matched KV key: %s', (kvKey) => {
    const registry = createSyntheticCleanupRegistry({
      runId: 'syn-20260728T210000Z-deadbeef',
      startedAt: '2026-07-28T21:00:00.000Z',
    })
    registry.releaseUsers.push({
      role: 'a',
      username:
        `synthetic-release-${registry.runId}-a@example.invalid`,
      cognitoSub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
    registry.kvKeys.push(kvKey)

    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', registry),
    ).toThrow('SYNTHETIC_RELEASE_KV_KEY_INVALID')
  })

  it('rejects KV keys for a release user without a known Cognito subject', () => {
    const registry = createSyntheticCleanupRegistry({
      runId: 'syn-20260728T210000Z-deadbeef',
      startedAt: '2026-07-28T21:00:00.000Z',
    })
    registry.releaseUsers.push({
      role: 'a',
      username:
        `synthetic-release-${registry.runId}-a@example.invalid`,
      cognitoSub: null,
    })
    registry.kvKeys.push(
      'user:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:profil',
    )

    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', registry),
    ).toThrow('SYNTHETIC_RELEASE_KV_KEY_INVALID')
  })

  it('enforces bounded strict full-release registry fields', () => {
    const registry = createSyntheticCleanupRegistry({
      runId: 'syn-20260728T210000Z-deadbeef',
      startedAt: '2026-07-28T21:00:00.000Z',
    })
    const releaseUser = {
      role: 'a' as const,
      username:
        `synthetic-release-${registry.runId}-a@example.invalid`,
      cognitoSub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }

    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', {
        ...registry,
        releaseUsers: [
          releaseUser,
          { ...releaseUser, role: 'b' as const },
          releaseUser,
        ],
      }),
    ).toThrow()
    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', {
        ...registry,
        kvKeys: Array.from(
          { length: 21 },
          (_, index) =>
            `user:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:profil-${index}`,
        ),
      }),
    ).toThrow()
    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', {
        ...registry,
        adminAgentState: {
          agentId: 'a'.repeat(81) as 'publikacja',
          enabled: true,
        },
      }),
    ).toThrow()
    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', {
        ...registry,
        releaseUsers: [
          {
            ...releaseUser,
            extra: true,
          },
        ],
      } as unknown as ReturnType<
        typeof createSyntheticCleanupRegistry
      >),
    ).toThrow()
  })

  it('rejects duplicate or malformed fact IDs and deletion receipts', () => {
    const registry = createSyntheticCleanupRegistry({
      runId: 'syn-20260728T210000Z-deadbeef',
      startedAt: '2026-07-28T21:00:00.000Z',
    })
    const factId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    registry.factIds.push(factId, factId)

    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', registry),
    ).toThrow('SYNTHETIC_RELEASE_FACT_ID_DUPLICATE')

    registry.factIds = ['not-a-uuid']
    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', registry),
    ).toThrow()

    registry.factIds = []
    registry.sourceJobIds = [
      factId,
      factId,
    ]
    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', registry),
    ).toThrow('SYNTHETIC_RELEASE_SOURCE_JOB_ID_DUPLICATE')

    registry.sourceJobIds = []
    registry.proposalIds = [
      factId,
      factId,
    ]
    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', registry),
    ).toThrow('SYNTHETIC_RELEASE_PROPOSAL_ID_DUPLICATE')

    registry.proposalIds = []
    registry.accountDeletionReceipts = [
      {
        role: 'a',
        ok: true,
        sourceObjects: 0,
        propertyStudio: 1,
        accountKeys: 5,
      },
      {
        role: 'a',
        ok: true,
        sourceObjects: 1,
        propertyStudio: 1,
        accountKeys: 5,
      },
    ]
    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', registry),
    ).toThrow('SYNTHETIC_RELEASE_DELETION_ROLE_DUPLICATE')

    registry.accountDeletionReceipts = [
      {
        role: 'a',
        ok: true,
        sourceObjects: -1,
        propertyStudio: 1,
        accountKeys: 5,
      },
    ]
    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', registry),
    ).toThrow()
  })

  it('allows cleanup to restore only the explicitly approved admin agent', () => {
    const registry = createSyntheticCleanupRegistry({
      runId: 'syn-20260728T210000Z-deadbeef',
      startedAt: '2026-07-28T21:00:00.000Z',
    })
    expect(() =>
      parseSyntheticCleanupRegistry({
        ...registry,
        adminAgentState: {
          agentId: 'prawny',
          enabled: true,
        },
      }),
    ).toThrow()
  })

  it('bounds the secret-free ephemeral state expiry to the run window', () => {
    const registry = createSyntheticCleanupRegistry({
      runId: 'syn-20260728T210000Z-deadbeef',
      startedAt: '2026-07-28T21:00:00.000Z',
    })

    registry.ephemeralStateExpiresAt = 1_785_272_465
    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', registry),
    ).not.toThrow()

    registry.ephemeralStateExpiresAt = 1_785_272_399
    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', registry),
    ).toThrow('SYNTHETIC_RELEASE_EPHEMERAL_EXPIRY_INVALID')

    registry.ephemeralStateExpiresAt = 1_785_276_001
    expect(() =>
      saveSyntheticCleanupRegistry('/tmp', registry),
    ).toThrow('SYNTHETIC_RELEASE_EPHEMERAL_EXPIRY_INVALID')
  })
})
