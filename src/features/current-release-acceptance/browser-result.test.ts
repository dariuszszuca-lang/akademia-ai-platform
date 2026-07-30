import {
  lstat,
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  symlink,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getCurrentReleasePaths,
  writeCurrentReleaseResult,
} from '../../../e2e/current-release/journal'
import { createCurrentReleaseScenarioRecorder } from '../../../e2e/current-release/result'
import {
  currentReleaseBrowserScenarios,
  parseBrowserExecutionResult,
  type BrowserExecutionResult,
} from './browser-result'

const runId = 'syn-20260729T220000Z-deadbeef'
const cognitoV7SubjectA =
  'b3e4d882-2071-700e-4b23-0551e29214b6'
const cognitoV7SubjectB =
  'c4f5e993-3182-700f-5c34-1662f3a325c7'

function validBrowserResult(): BrowserExecutionResult {
  return {
    scenarios: currentReleaseBrowserScenarios.map((name) => ({
      name,
      status: 'passed',
      durationMs: 10,
    })),
    modelIds: [
      'claude-sonnet-4-6',
      'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
    ],
    usage: {
      onboardingGenerationCalls: 9,
      agentCalls: 8,
      sourcePipelineCalls: 1,
      observedPipelineCostUsd: 0.25,
    },
  }
}

describe('browser execution result contract', () => {
  it('accepts exactly 20 unique canonical browser scenarios without cleanup', () => {
    const parsed = parseBrowserExecutionResult(validBrowserResult())

    expect(currentReleaseBrowserScenarios).toHaveLength(20)
    expect(currentReleaseBrowserScenarios).not.toContain(
      'cleanup.complete',
    )
    expect(parsed.scenarios.map((scenario) => scenario.name)).toEqual(
      currentReleaseBrowserScenarios,
    )
  })

  it('rejects missing, duplicate and runner-owned cleanup scenarios', () => {
    const missing = validBrowserResult()
    missing.scenarios = missing.scenarios.slice(0, -1)
    expect(() => parseBrowserExecutionResult(missing)).toThrow()

    const duplicate = validBrowserResult()
    duplicate.scenarios[18] = duplicate.scenarios[0]!
    expect(() => parseBrowserExecutionResult(duplicate)).toThrow()

    const cleanup = validBrowserResult() as unknown as {
      scenarios: Array<Record<string, unknown>>
    }
    cleanup.scenarios[18] = {
      name: 'cleanup.complete',
      status: 'passed',
      durationMs: 10,
    }
    expect(() => parseBrowserExecutionResult(cleanup)).toThrow()
  })

  it('rejects duplicate or unsafe model IDs and forbidden nested fields', () => {
    expect(() =>
      parseBrowserExecutionResult({
        ...validBrowserResult(),
        modelIds: ['claude-sonnet-4-6', 'claude-sonnet-4-6'],
      }),
    ).toThrow()
    expect(() =>
      parseBrowserExecutionResult({
        ...validBrowserResult(),
        modelIds: ['sk-ant-synthetic-marker'],
      }),
    ).toThrow()

    for (const field of [
      'prompt',
      'response',
      'password',
      'token',
      'cookie',
      'signedUrl',
      'fileName',
      'acceptanceSecret',
      'signature',
      'nonce',
      'expiresAt',
    ]) {
      expect(() =>
        parseBrowserExecutionResult({
          ...validBrowserResult(),
          usage: {
            ...validBrowserResult().usage,
            [field]: 'must-not-be-recorded',
          },
        }),
      ).toThrow('CURRENT_RELEASE_BROWSER_RESULT_FORBIDDEN_FIELD')
    }
  })

  it('rejects a standalone high-entropy acceptance secret value before schema parsing', () => {
    expect(() =>
      parseBrowserExecutionResult({
        ...validBrowserResult(),
        modelIds: ['s'.repeat(43)],
      }),
    ).toThrow('CURRENT_RELEASE_BROWSER_RESULT_SECRET_VALUE')
  })

  it('rejects a known secret embedded inside an otherwise valid storage key without echoing it', () => {
    const secret = 'Known-user-password-123!'
    const result = validBrowserResult()
    result.registryUpdate = {
      releaseUsers: [
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
      ],
      organizationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      organizationPrefix:
        'originals/organizations/cccccccc-cccc-4ccc-8ccc-cccccccccccc/',
      projectIds: [],
      sourceIds: [],
      storageKeys: [
        `originals/organizations/cccccccc-cccc-4ccc-8ccc-cccccccccccc/${secret}.pdf`,
      ],
      kvKeys: [],
      adminAgentState: null,
    }

    let message = ''
    try {
      parseBrowserExecutionResult(result, [secret])
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).toBe('CURRENT_RELEASE_BROWSER_RESULT_SECRET_VALUE')
    expect(message).not.toContain(secret)
  })

  it('rejects a known secret embedded in a receipt error field before schema parsing', () => {
    const secret = 'Known-acceptance-secret-456!'
    const result = {
      ...validBrowserResult(),
      registryUpdate: {
        releaseUsers: [],
        organizationId: null,
        organizationPrefix: null,
        projectIds: [],
        sourceIds: [],
        storageKeys: [],
        kvKeys: [],
        adminAgentState: null,
        accountDeletionReceipts: [
          {
            role: 'a',
            ok: false,
            error: `provider rejected ${secret} during cleanup`,
          },
        ],
      },
    }

    expect(() =>
      parseBrowserExecutionResult(result, [secret]),
    ).toThrow('CURRENT_RELEASE_BROWSER_RESULT_SECRET_VALUE')
  })

  it('preserves only strict fact, deletion and ephemeral cleanup evidence', () => {
    const result = validBrowserResult()
    result.registryUpdate = {
      releaseUsers: [
        {
          role: 'a',
          username: `synthetic-release-${runId}-a@example.invalid`,
          cognitoSub: cognitoV7SubjectA,
        },
        {
          role: 'b',
          username: `synthetic-release-${runId}-b@example.invalid`,
          cognitoSub: cognitoV7SubjectB,
        },
      ],
      organizationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      organizationPrefix:
        'originals/organizations/cccccccc-cccc-4ccc-8ccc-cccccccccccc/',
      projectIds: ['dddddddd-dddd-4ddd-8ddd-dddddddddddd'],
      factIds: ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'],
      sourceJobIds: ['11111111-1111-4111-8111-111111111111'],
      proposalIds: ['22222222-2222-4222-8222-222222222222'],
      sourceIds: ['ffffffff-ffff-4fff-8fff-ffffffffffff'],
      storageKeys: [
        'originals/organizations/cccccccc-cccc-4ccc-8ccc-cccccccccccc/source.pdf',
      ],
      kvKeys: [],
      adminAgentState: null,
      accountDeletionReceipts: [
        {
          role: 'a',
          ok: true,
          sourceObjects: 2,
          propertyStudio: 1,
          accountKeys: 5,
        },
      ],
      ephemeralStateExpiresAt: 1_785_362_465,
    }

    expect(
      parseBrowserExecutionResult(result).registryUpdate,
    ).toEqual(result.registryUpdate)

    result.registryUpdate.factIds!.push(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    )
    expect(() => parseBrowserExecutionResult(result)).toThrow()
  })

  it('rejects cleanup evidence for an admin agent outside the exact release scope', () => {
    const result = validBrowserResult()
    result.registryUpdate = {
      releaseUsers: [
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
      ],
      organizationId: null,
      organizationPrefix: null,
      projectIds: [],
      sourceIds: [],
      storageKeys: [],
      kvKeys: [],
      adminAgentState: {
        agentId: 'prawny' as 'publikacja',
        enabled: true,
      },
    }

    expect(() => parseBrowserExecutionResult(result)).toThrow()
  })
})

describe('current release scenario recorder', () => {
  it('returns canonical results and fills every unrecorded scenario fail-closed', () => {
    const recorder = createCurrentReleaseScenarioRecorder()
    recorder.pass('auth.registration', 25)
    recorder.fail('auth.session', 30, 'AUTH_SESSION_FAILED')

    const result = recorder.finalize()

    expect(result.map((scenario) => scenario.name)).toEqual(
      currentReleaseBrowserScenarios,
    )
    expect(result[0]).toEqual({
      name: 'auth.registration',
      status: 'passed',
      durationMs: 25,
    })
    expect(result[1]).toEqual({
      name: 'auth.session',
      status: 'failed',
      durationMs: 30,
      errorCode: 'AUTH_SESSION_FAILED',
    })
    expect(result[2]).toEqual({
      name: currentReleaseBrowserScenarios[2],
      status: 'failed',
      durationMs: 0,
      errorCode: 'CURRENT_RELEASE_SCENARIO_NOT_RUN',
    })
  })

  it('rejects duplicate recording and unsafe failure details', () => {
    const recorder = createCurrentReleaseScenarioRecorder()
    recorder.pass('auth.registration', 10)

    expect(() =>
      recorder.fail(
        'auth.registration',
        11,
        'AUTH_REGISTRATION_FAILED',
      ),
    ).toThrow('CURRENT_RELEASE_SCENARIO_DUPLICATE')
    expect(() =>
      recorder.fail(
        'auth.session',
        10,
        'unsafe response from provider',
      ),
    ).toThrow()
  })
})

describe('atomic browser result writer', () => {
  it('validates then atomically writes a private result without temporary residue', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'release-result-'))
    const paths = getCurrentReleasePaths(workspace, runId)

    await writeCurrentReleaseResult(
      paths,
      runId,
      validBrowserResult(),
      [],
    )

    expect((await lstat(paths.resultPath)).mode & 0o777).toBe(0o600)
    expect(JSON.parse(await readFile(paths.resultPath, 'utf8'))).toEqual(
      validBrowserResult(),
    )
    expect(await readdir(paths.browserDirectory)).toEqual([
      'result.json',
    ])
  })

  it('does not write invalid results or paths and rejects a symlinked destination', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'release-result-'))
    const paths = getCurrentReleasePaths(workspace, runId)
    const invalid = validBrowserResult()
    invalid.scenarios = invalid.scenarios.slice(0, -1)

    await expect(
      writeCurrentReleaseResult(paths, runId, invalid, []),
    ).rejects.toThrow()
    await expect(lstat(paths.resultPath)).rejects.toMatchObject({
      code: 'ENOENT',
    })

    await expect(
      writeCurrentReleaseResult(
        { ...paths, resultPath: join(workspace, 'outside.json') },
        runId,
        validBrowserResult(),
        [],
      ),
    ).rejects.toThrow('CURRENT_RELEASE_PATH_INVALID')

    await mkdir(paths.browserDirectory, { recursive: true })
    await symlink(join(workspace, 'outside.json'), paths.resultPath)
    await expect(
      writeCurrentReleaseResult(
        paths,
        runId,
        validBrowserResult(),
        [],
      ),
    ).rejects.toThrow('CURRENT_RELEASE_PATH_INVALID')
  })

  it('rejects embedded known secrets before atomic persistence', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'release-result-'))
    const paths = getCurrentReleasePaths(workspace, runId)
    const secret = 'Known-admin-password-789!'
    const result = {
      ...validBrowserResult(),
      modelIds: [`claude-sonnet-4-6-${secret}`],
    }

    await expect(
      writeCurrentReleaseResult(paths, runId, result, [secret]),
    ).rejects.toThrow('CURRENT_RELEASE_BROWSER_RESULT_SECRET_VALUE')
    await expect(lstat(paths.resultPath)).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })
})
