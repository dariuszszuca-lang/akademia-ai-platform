import {
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  symlink,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createCurrentReleaseJournal,
  getCurrentReleasePaths,
  prepareCurrentReleaseResultPath,
  readCurrentReleaseJournal,
  writeCurrentReleaseJournal,
  writeCurrentReleaseReportArtifacts,
} from '../../../e2e/current-release/journal'
import { createSyntheticCleanupRegistry } from '../synthetic-acceptance/cleanup-registry'

const runId = 'syn-20260729T220000Z-deadbeef'

function registry() {
  const value = createSyntheticCleanupRegistry({
    runId,
    startedAt: '2026-07-29T22:00:00.000Z',
  })
  value.releaseUsers = [
    {
      role: 'a',
      username: `synthetic-release-${runId}-a@example.invalid`,
      cognitoSub: null,
    },
    {
      role: 'b',
      username: `synthetic-release-${runId}-b@example.invalid`,
      cognitoSub: null,
    },
  ]
  return value
}

describe('atomic current release journal', () => {
  it('writes a fully validated journal atomically with private permissions', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'release-journal-'))
    const paths = getCurrentReleasePaths(workspace, runId)

    await writeCurrentReleaseJournal(paths, registry())

    await expect(
      readCurrentReleaseJournal(paths, runId),
    ).resolves.toEqual(registry())
    expect((await lstat(paths.registryPath)).mode & 0o777).toBe(0o600)
    const names = await readFile(paths.registryPath, 'utf8')
    expect(names).not.toContain('password')
    expect(names).not.toContain('token')
  })

  it('records every discovered cleanup handle before returning', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'release-journal-'))
    const paths = getCurrentReleasePaths(workspace, runId)
    await writeCurrentReleaseJournal(paths, registry())
    const journal = createCurrentReleaseJournal(paths, runId)
    const subject = '11111111-1111-4111-8111-111111111111'

    await journal.recordUserSubject('a', subject)
    await journal.recordKvKey(`user:${subject}:profil`)
    await journal.recordAdminPreviousState('publikacja', true)
    await journal.recordResources({
      organizationId: '22222222-2222-4222-8222-222222222222',
      projectId: '33333333-3333-4333-8333-333333333333',
      factId: '44444444-4444-4444-8444-444444444444',
      sourceId: '55555555-5555-4555-8555-555555555555',
      sourceJobId: '66666666-6666-4666-8666-666666666666',
      proposalId: '77777777-7777-4777-8777-777777777777',
      storageKey:
        'originals/organizations/22222222-2222-4222-8222-222222222222/properties/33333333-3333-4333-8333-333333333333/sources/55555555-5555-4555-8555-555555555555/original',
    })
    await journal.recordFactId(
      '44444444-4444-4444-8444-444444444444',
    )
    await journal.recordDeletionReceipt('a', {
      ok: true,
      sourceObjects: 2,
      propertyStudio: 1,
      accountKeys: 5,
    })
    await journal.recordDeletionReceipt('a', {
      ok: true,
      sourceObjects: 2,
      propertyStudio: 1,
      accountKeys: 5,
    })
    await journal.recordEphemeralStateExpiresAt(1_785_362_465)

    const saved = await readCurrentReleaseJournal(paths, runId)
    expect(saved.releaseUsers[0]?.cognitoSub).toBe(subject)
    expect(saved.kvKeys).toEqual([`user:${subject}:profil`])
    expect(saved.adminAgentState).toEqual({
      agentId: 'publikacja',
      enabled: true,
    })
    expect(saved.factIds).toEqual([
      '44444444-4444-4444-8444-444444444444',
    ])
    expect(saved.sourceJobIds).toEqual([
      '66666666-6666-4666-8666-666666666666',
    ])
    expect(saved.proposalIds).toEqual([
      '77777777-7777-4777-8777-777777777777',
    ])
    expect(saved.accountDeletionReceipts).toEqual([
      {
        role: 'a',
        ok: true,
        sourceObjects: 2,
        propertyStudio: 1,
        accountKeys: 5,
      },
    ])
    expect(saved.ephemeralStateExpiresAt).toBe(1_785_362_465)
  })

  it('rejects invalid facts and conflicting recovery evidence before disk write', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'release-journal-'))
    const paths = getCurrentReleasePaths(workspace, runId)
    await writeCurrentReleaseJournal(paths, registry())
    const journal = createCurrentReleaseJournal(paths, runId)

    await expect(journal.recordFactId('not-a-uuid')).rejects.toThrow()
    await journal.recordDeletionReceipt('a', {
      ok: true,
      sourceObjects: 0,
      propertyStudio: 1,
      accountKeys: 5,
    })
    await expect(
      journal.recordDeletionReceipt('a', {
        ok: true,
        sourceObjects: 1,
        propertyStudio: 1,
        accountKeys: 5,
      }),
    ).rejects.toThrow(
      'CURRENT_RELEASE_DELETION_RECEIPT_CONFLICT',
    )
    await journal.recordAdminPreviousState('publikacja', true)
    await expect(
      journal.recordAdminPreviousState('publikacja', false),
    ).rejects.toThrow('CURRENT_RELEASE_ADMIN_STATE_CONFLICT')

    const saved = await readCurrentReleaseJournal(paths, runId)
    expect(saved.factIds).toEqual([])
    expect(saved.accountDeletionReceipts).toHaveLength(1)
    expect(JSON.stringify(saved)).not.toMatch(
      /password|token|cookie|nonce|signedUrl/i,
    )
  })

  it('rejects a symlinked journal target and paths outside the exact run directories', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'release-journal-'))
    const paths = getCurrentReleasePaths(workspace, runId)
    const outside = join(workspace, 'outside.json')
    await writeCurrentReleaseJournal(paths, registry())
    await symlink(outside, `${paths.registryPath}.unsafe`)

    await expect(
      writeCurrentReleaseJournal(
        { ...paths, registryPath: `${paths.registryPath}.unsafe` },
        registry(),
      ),
    ).rejects.toThrow('CURRENT_RELEASE_PATH_INVALID')
    expect(() =>
      getCurrentReleasePaths(workspace, '../outside'),
    ).toThrow()
  })

  it('rejects symlinked browser results and report destinations', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'release-journal-'))
    const paths = getCurrentReleasePaths(workspace, runId)
    const outside = join(workspace, 'outside.json')
    await writeCurrentReleaseJournal(paths, registry())
    await mkdir(paths.browserDirectory, { recursive: true })
    await symlink(outside, paths.resultPath)
    await symlink(
      outside,
      join(paths.reportDirectory, `${runId}.json`),
    )

    await expect(
      prepareCurrentReleaseResultPath(paths, runId),
    ).rejects.toThrow('CURRENT_RELEASE_PATH_INVALID')
    await expect(
      writeCurrentReleaseReportArtifacts(
        paths,
        runId,
        '{}',
        '# report',
      ),
    ).rejects.toThrow('CURRENT_RELEASE_PATH_INVALID')
  })

  it('rejects a registry whose run id differs from the contained journal path', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'release-journal-'))
    const paths = getCurrentReleasePaths(workspace, runId)
    const mismatched = registry()
    mismatched.runId = 'syn-20260729T220000Z-feedface'
    mismatched.releaseUsers = [
      {
        role: 'a',
        username:
          'synthetic-release-syn-20260729T220000Z-feedface-a@example.invalid',
        cognitoSub: null,
      },
      {
        role: 'b',
        username:
          'synthetic-release-syn-20260729T220000Z-feedface-b@example.invalid',
        cognitoSub: null,
      },
    ]

    await expect(
      writeCurrentReleaseJournal(paths, mismatched),
    ).rejects.toThrow('CURRENT_RELEASE_JOURNAL_INVALID')
    await expect(lstat(paths.registryPath)).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })
})
