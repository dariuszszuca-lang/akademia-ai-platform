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
  removeSyntheticCleanupRegistry,
  saveSyntheticCleanupRegistry,
} from './cleanup-registry'

describe('synthetic cleanup registry', () => {
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
})
