import { writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  buildPlaywrightChildEnvironment,
  createDefaultBrowserExecutor,
  CURRENT_RELEASE_PRODUCTION_URL,
  runCurrentReleaseAcceptance,
  type CurrentReleaseRunnerDependencies,
  type CurrentReleaseRunnerOptions,
} from './runner'
import { getCurrentReleasePaths } from '../../../e2e/current-release/journal'
import { createSyntheticCleanupRegistry } from '../synthetic-acceptance/cleanup-registry'
import {
  currentReleaseScenarios,
  type ScenarioResult,
} from './domain'

const runId = 'syn-20260729T220000Z-deadbeef'
const adminPassword = 'Synthetic-admin-password-123!'

function validOptions(
  overrides: Partial<CurrentReleaseRunnerOptions> = {},
): CurrentReleaseRunnerOptions {
  return {
    allowProduction: true,
    baseUrl: CURRENT_RELEASE_PRODUCTION_URL,
    maxCostUsd: 2,
    profile: 'akademia-ai',
    region: 'eu-central-1',
    adminPassword,
    workspaceRoot: '/synthetic/workspace',
    ...overrides,
  }
}

function passingScenarios(): ScenarioResult[] {
  return currentReleaseScenarios.map((name) => ({
    name,
    status: 'passed' as const,
    durationMs: 10,
  }))
}

function validDependencies(
  overrides: Partial<CurrentReleaseRunnerDependencies> = {},
): CurrentReleaseRunnerDependencies {
  return {
    now: vi
      .fn()
      .mockReturnValueOnce(new Date('2026-07-29T22:00:00.000Z'))
      .mockReturnValue(new Date('2026-07-29T22:01:00.000Z')),
    createRunId: vi.fn(() => runId),
    createPassword: vi
      .fn()
      .mockReturnValueOnce('Synthetic-user-A-password-123!')
      .mockReturnValueOnce('Synthetic-user-B-password-456!'),
    getConfiguredRegion: vi.fn(async () => 'eu-central-1'),
    getCallerIdentity: vi.fn(async () => ({
      Account: '261965598943',
      Arn: 'arn:aws:iam::261965598943:user/akademia-wojtka-admin-darek',
    })),
    checkDlq: vi.fn(async () => 0),
    checkAlarms: vi.fn(async () => 0),
    saveRegistry: vi.fn(async () => undefined),
    loadRegistry: vi.fn(async () => null),
    removeRegistry: vi.fn(async () => undefined),
    createGuardNonce: vi.fn(() => 'a'.repeat(43)),
    prepareGuard: vi.fn(async () => undefined),
    executeBrowser: vi.fn(async () => ({
      scenarios: passingScenarios(),
      modelIds: ['claude-sonnet-4-6'],
      usage: {
        onboardingGenerationCalls: 7,
        agentCalls: 8,
        observedPipelineCostUsd: 0.11,
      },
    })),
    cleanup: vi.fn(async () => ({
      databaseEmpty: true,
      cognitoUsersAbsent: true,
      kvKeysAbsent: true,
      s3VersionsRemaining: 0,
      adminStateRestored: true,
      dlqMessagesVisible: 0,
      alarmsNotOk: 0,
    })),
    getCommitSha: vi.fn(async () => 'a'.repeat(40)),
    getDeploymentId: vi.fn(async () => 'dpl_AbCdEf123456'),
    writeReport: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('current release production preflight', () => {
  it.each([
    [{ allowProduction: false }, 'CURRENT_RELEASE_PRODUCTION_NOT_ALLOWED'],
    [
      { baseUrl: 'https://akademia-ai-platform.vercel.app/path' },
      'CURRENT_RELEASE_PRODUCTION_URL_INVALID',
    ],
    [
      { baseUrl: 'https://akademia-ai-platform.vercel.app/?x=1' },
      'CURRENT_RELEASE_PRODUCTION_URL_INVALID',
    ],
    [
      { baseUrl: 'https://user@akademia-ai-platform.vercel.app' },
      'CURRENT_RELEASE_PRODUCTION_URL_INVALID',
    ],
    [
      { baseUrl: 'http://akademia-ai-platform.vercel.app' },
      'CURRENT_RELEASE_PRODUCTION_URL_INVALID',
    ],
    [{ region: 'us-east-1' }, 'CURRENT_RELEASE_AWS_REGION_INVALID'],
    [{ maxCostUsd: 2.01 }, 'CURRENT_RELEASE_COST_LIMIT_INVALID'],
    [{ maxCostUsd: 0 }, 'CURRENT_RELEASE_COST_LIMIT_INVALID'],
    [{ maxCostUsd: Number.NaN }, 'CURRENT_RELEASE_COST_LIMIT_INVALID'],
    [{ adminPassword: undefined }, 'CURRENT_RELEASE_ADMIN_PASSWORD_MISSING'],
    [{ adminPassword: '' }, 'CURRENT_RELEASE_ADMIN_PASSWORD_MISSING'],
    [{ adminPassword: '   ' }, 'CURRENT_RELEASE_ADMIN_PASSWORD_MISSING'],
  ] as const)(
    'rejects invalid local option %j before side effects',
    async (override, errorCode) => {
      const dependencies = validDependencies()

      await expect(
        runCurrentReleaseAcceptance(
          validOptions(override),
          dependencies,
        ),
      ).rejects.toThrow(errorCode)

      expect(dependencies.getCallerIdentity).not.toHaveBeenCalled()
      expect(dependencies.saveRegistry).not.toHaveBeenCalled()
      expect(dependencies.executeBrowser).not.toHaveBeenCalled()
      expect(dependencies.cleanup).not.toHaveBeenCalled()
    },
  )

  it('rejects a configured region mismatch before registry or browser work', async () => {
    const dependencies = validDependencies({
      getConfiguredRegion: vi.fn(async () => 'us-east-1'),
    })

    await expect(
      runCurrentReleaseAcceptance(validOptions(), dependencies),
    ).rejects.toThrow('CURRENT_RELEASE_AWS_REGION_INVALID')

    expect(dependencies.saveRegistry).not.toHaveBeenCalled()
    expect(dependencies.executeBrowser).not.toHaveBeenCalled()
    expect(dependencies.cleanup).not.toHaveBeenCalled()
  })

  it.each([
    [
      {
        Account: '021655150975',
        Arn: 'arn:aws:iam::021655150975:user/akademia-wojtka-admin-darek',
      },
      'CURRENT_RELEASE_AWS_ACCOUNT_INVALID',
    ],
    [
      {
        Account: '261965598943',
        Arn: 'arn:aws:iam::261965598943:user/admin-darek',
      },
      'CURRENT_RELEASE_AWS_CALLER_INVALID',
    ],
    [
      {
        Account: '261965598943',
        Arn: 'arn:aws:sts::261965598943:assumed-role/Administrator/akademia-wojtka-admin-darek',
      },
      'CURRENT_RELEASE_AWS_CALLER_INVALID',
    ],
  ] as const)(
    'rejects caller %j before registry or browser work',
    async (identity, errorCode) => {
      const dependencies = validDependencies({
        getCallerIdentity: vi.fn(async () => identity),
      })

      await expect(
        runCurrentReleaseAcceptance(validOptions(), dependencies),
      ).rejects.toThrow(errorCode)

      expect(dependencies.saveRegistry).not.toHaveBeenCalled()
      expect(dependencies.executeBrowser).not.toHaveBeenCalled()
      expect(dependencies.cleanup).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['DLQ', { checkDlq: vi.fn(async () => 1) }, 'CURRENT_RELEASE_DLQ_NOT_EMPTY'],
    ['alarms', { checkAlarms: vi.fn(async () => 1) }, 'CURRENT_RELEASE_ALARMS_NOT_OK'],
  ])(
    'rejects unsafe %s state before registry or browser work',
    async (_label, override, errorCode) => {
      const dependencies = validDependencies(override)

      await expect(
        runCurrentReleaseAcceptance(validOptions(), dependencies),
      ).rejects.toThrow(errorCode)

      expect(dependencies.saveRegistry).not.toHaveBeenCalled()
      expect(dependencies.executeBrowser).not.toHaveBeenCalled()
      expect(dependencies.cleanup).not.toHaveBeenCalled()
    },
  )
})

describe('current release execution boundary', () => {
  it('passes secrets only to the browser environment and keeps the registry secret-free', async () => {
    const dependencies = validDependencies()

    await runCurrentReleaseAcceptance(validOptions(), dependencies)

    const browserInput = vi.mocked(dependencies.executeBrowser).mock
      .calls[0]![0]
    expect(browserInput.childEnv).toMatchObject({
      ADMIN_PASSWORD: adminPassword,
      CURRENT_RELEASE_USER_A_PASSWORD:
        'Synthetic-user-A-password-123!',
      CURRENT_RELEASE_USER_B_PASSWORD:
        'Synthetic-user-B-password-456!',
    })
    const savedRegistry = vi.mocked(dependencies.saveRegistry).mock
      .calls[0]![0]
    const serializedRegistry = JSON.stringify(savedRegistry)
    expect(serializedRegistry).not.toContain(adminPassword)
    expect(serializedRegistry).not.toContain('password')
    expect(serializedRegistry).not.toContain('token')

    const report = vi.mocked(dependencies.writeReport).mock.calls[0]![0]
    const serializedReport = JSON.stringify(report)
    expect(serializedReport).not.toContain(adminPassword)
    expect(serializedReport).not.toContain(
      'Synthetic-user-A-password-123!',
    )
    expect(report.estimatedAnthropicCostUsd).toBe(1.06)
    expect(report.observedPipelineCostUsd).toBe(0.11)
    expect(report.providerCostUsd).toBe(1.17)
  })

  it('passes the actual per-run maximum to the child and validates actual usage', async () => {
    const dependencies = validDependencies({
      executeBrowser: vi.fn(async () => ({
        scenarios: passingScenarios(),
        modelIds: ['claude-sonnet-4-6'],
        usage: {
          onboardingGenerationCalls: 0,
          agentCalls: 3,
          sourcePipelineCalls: 1,
          observedPipelineCostUsd: 0.1,
        },
      })),
    })

    const report = await runCurrentReleaseAcceptance(
      validOptions({ maxCostUsd: 0.5 }),
      dependencies,
    )

    const childInput = vi.mocked(dependencies.executeBrowser).mock
      .calls[0]![0]
    expect(JSON.parse(childInput.childEnv.CURRENT_RELEASE_BUDGET!)).toEqual(
      {
        maxUsd: 0.5,
        stopBeforeUsd: 0.5,
        unitCosts: {
          onboardingGenerationUsd: 0.06,
          agentCallUsd: 0.08,
          sourcePipelineUsd: 0.25,
        },
      },
    )
    expect(report.estimatedAnthropicCostUsd).toBe(0.24)
    expect(report.providerCostUsd).toBe(0.34)
  })

  it('does not pass unrelated parent secrets or endpoint overrides to Playwright', () => {
    const environment = buildPlaywrightChildEnvironment(
      {
        PATH: '/usr/bin',
        HOME: '/synthetic/home',
        TMPDIR: '/tmp',
        LANG: 'pl_PL.UTF-8',
        AWS_ACCESS_KEY_ID: 'synthetic-access-key',
        AWS_SECRET_ACCESS_KEY: 'synthetic-secret',
        AWS_ENDPOINT_URL: 'http://127.0.0.1:9999',
        STRIPE_SECRET_KEY: 'synthetic-stripe',
        ANTHROPIC_API_KEY: 'synthetic-anthropic',
        PINECONE_API_KEY: 'synthetic-pinecone',
        VERCEL_TOKEN: 'synthetic-vercel',
      },
      {
        CURRENT_RELEASE_RUN_ID: runId,
        CURRENT_RELEASE_BASE_URL: CURRENT_RELEASE_PRODUCTION_URL,
      },
    )

    expect(environment).toEqual({
      PATH: '/usr/bin',
      HOME: '/synthetic/home',
      TMPDIR: '/tmp',
      LANG: 'pl_PL.UTF-8',
      CURRENT_RELEASE_RUN_ID: runId,
      CURRENT_RELEASE_BASE_URL: CURRENT_RELEASE_PRODUCTION_URL,
    })
  })

  it('passes the allowlisted environment to the actual browser wrapper', async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), 'release-browser-env-'),
    )
    const paths = getCurrentReleasePaths(workspaceRoot, runId)
    const registry = createSyntheticCleanupRegistry({
      runId,
      startedAt: '2026-07-29T22:00:00.000Z',
    })
    let capturedEnvironment: NodeJS.ProcessEnv | undefined
    const executeBrowser = createDefaultBrowserExecutor(
      workspaceRoot,
      {
        processEnvironment: {
          PATH: '/usr/bin',
          HOME: '/synthetic/home',
          AWS_ACCESS_KEY_ID: 'synthetic-access-key',
          STRIPE_SECRET_KEY: 'synthetic-stripe',
        },
        executeFile: (_file, _args, options) => {
          capturedEnvironment = options.env
          writeFileSync(
            paths.resultPath,
            JSON.stringify({
              scenarios: passingScenarios(),
              modelIds: ['claude-sonnet-4-6'],
              usage: {
                onboardingGenerationCalls: 0,
                agentCalls: 0,
                sourcePipelineCalls: 0,
                observedPipelineCostUsd: 0,
              },
            }),
          )
          return ''
        },
      },
    )

    await executeBrowser({
      runId,
      baseUrl: CURRENT_RELEASE_PRODUCTION_URL,
      childEnv: {
        CURRENT_RELEASE_RUN_ID: runId,
        CURRENT_RELEASE_BASE_URL: CURRENT_RELEASE_PRODUCTION_URL,
      },
      costReservations: {
        onboardingGenerationUsd: 0.06,
        onboardingGenerationCalls: 7,
        agentCallUsd: 0.08,
        agentCalls: 8,
        sourcePipelineUsd: 0.25,
      },
      resultPath: paths.resultPath,
      registryPath: paths.registryPath,
      paths,
      registry,
    })

    expect(capturedEnvironment).toEqual({
      PATH: '/usr/bin',
      HOME: '/synthetic/home',
      CURRENT_RELEASE_RUN_ID: runId,
      CURRENT_RELEASE_BASE_URL: CURRENT_RELEASE_PRODUCTION_URL,
    })
  })

  it('always cleans up after a browser failure and preserves the registry for recovery', async () => {
    const secret = 'Synthetic-user-A-password-123!'
    const dependencies = validDependencies({
      executeBrowser: vi.fn(async () => {
        throw new Error(`browser failed with ${secret}`)
      }),
    })

    await expect(
      runCurrentReleaseAcceptance(validOptions(), dependencies),
    ).rejects.toThrow('CURRENT_RELEASE_BROWSER_FAILED')

    expect(dependencies.cleanup).toHaveBeenCalledTimes(1)
    expect(dependencies.removeRegistry).not.toHaveBeenCalled()
    expect(dependencies.writeReport).not.toHaveBeenCalled()
    const cleanupInput = vi.mocked(dependencies.cleanup).mock.calls[0]![0]
    expect(JSON.stringify(cleanupInput)).not.toContain(secret)
  })

  it('reloads the atomic child journal before cleanup after browser failure', async () => {
    let diskRegistry:
      | Parameters<CurrentReleaseRunnerDependencies['saveRegistry']>[0]
      | null = null
    const subject = '11111111-1111-4111-8111-111111111111'
    const dependencies = validDependencies({
      saveRegistry: vi.fn(async (value) => {
        diskRegistry = structuredClone(value)
      }),
      loadRegistry: vi.fn(async () =>
        diskRegistry ? structuredClone(diskRegistry) : null,
      ),
      executeBrowser: vi.fn(async (input) => {
        const partial = structuredClone(input.registry)
        partial.releaseUsers[0]!.cognitoSub = subject
        partial.kvKeys.push(`user:${subject}:profil`)
        partial.adminAgentState = {
          agentId: 'publikacja',
          enabled: true,
        }
        await dependencies.saveRegistry(partial)
        throw new Error('synthetic browser failure')
      }),
    })

    await expect(
      runCurrentReleaseAcceptance(validOptions(), dependencies),
    ).rejects.toThrow('CURRENT_RELEASE_BROWSER_FAILED')

    const cleanupRegistry = vi.mocked(dependencies.cleanup).mock
      .calls[0]![0]
    expect(cleanupRegistry.releaseUsers[0]?.cognitoSub).toBe(subject)
    expect(cleanupRegistry.kvKeys).toEqual([
      `user:${subject}:profil`,
    ])
    expect(cleanupRegistry.adminAgentState).toEqual({
      agentId: 'publikacja',
      enabled: true,
    })
  })

  it('applies a validated secret-free child registry update before cleanup', async () => {
    const subjectA = '11111111-1111-4111-8111-111111111111'
    const subjectB = '22222222-2222-4222-8222-222222222222'
    const dependencies = validDependencies({
      executeBrowser: vi.fn(async () => ({
        scenarios: passingScenarios(),
        modelIds: ['claude-sonnet-4-6'],
        usage: {
          onboardingGenerationCalls: 7,
          agentCalls: 8,
          observedPipelineCostUsd: 0.11,
        },
        registryUpdate: {
          releaseUsers: [
            {
              role: 'a' as const,
              username: `synthetic-release-${runId}-a@example.invalid`,
              cognitoSub: subjectA,
            },
            {
              role: 'b' as const,
              username: `synthetic-release-${runId}-b@example.invalid`,
              cognitoSub: subjectB,
            },
          ],
          organizationId: '33333333-3333-4333-8333-333333333333',
          organizationPrefix:
            'originals/organizations/33333333-3333-4333-8333-333333333333/',
          projectIds: ['44444444-4444-4444-8444-444444444444'],
          sourceIds: ['55555555-5555-4555-8555-555555555555'],
          storageKeys: [
            'originals/organizations/33333333-3333-4333-8333-333333333333/source.pdf',
          ],
          kvKeys: [`user:${subjectA}:profil`],
          adminAgentState: {
            agentId: 'publikacja',
            enabled: true,
          },
        },
      })),
    })

    await runCurrentReleaseAcceptance(validOptions(), dependencies)

    const cleanupRegistry = vi.mocked(dependencies.cleanup).mock
      .calls[0]![0]
    expect(cleanupRegistry.releaseUsers[0]?.cognitoSub).toBe(subjectA)
    expect(cleanupRegistry.projectIds).toEqual([
      '44444444-4444-4444-8444-444444444444',
    ])
    expect(dependencies.saveRegistry).toHaveBeenCalledTimes(2)
  })

  it('writes a rejected report, preserves registry and exits nonzero when cleanup residue remains', async () => {
    const dependencies = validDependencies({
      cleanup: vi.fn(async () => ({
        databaseEmpty: true,
        cognitoUsersAbsent: true,
        kvKeysAbsent: true,
        s3VersionsRemaining: 1,
        adminStateRestored: true,
        dlqMessagesVisible: 0,
        alarmsNotOk: 0,
      })),
    })

    await expect(
      runCurrentReleaseAcceptance(validOptions(), dependencies),
    ).rejects.toThrow('CURRENT_RELEASE_ACCEPTANCE_REJECTED')
    const report = vi.mocked(dependencies.writeReport).mock.calls[0]![0]
    expect(report.accepted).toBe(false)
    expect(dependencies.removeRegistry).not.toHaveBeenCalled()
  })

  it('removes the registry only after successful cleanup and safe report persistence', async () => {
    const dependencies = validDependencies()

    const report = await runCurrentReleaseAcceptance(
      validOptions(),
      dependencies,
    )

    expect(report.accepted).toBe(true)
    expect(dependencies.writeReport).toHaveBeenCalledTimes(1)
    expect(dependencies.removeRegistry).toHaveBeenCalledWith(runId)
    expect(
      vi.mocked(dependencies.writeReport).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(dependencies.removeRegistry).mock
        .invocationCallOrder[0]!,
    )
  })

  it('writes a rejected report and preserves recovery registry when any scenario fails', async () => {
    const scenarios = passingScenarios()
    scenarios[0] = {
      ...scenarios[0]!,
      status: 'failed',
      errorCode: 'AUTH_REGISTRATION_FAILED',
    }
    const dependencies = validDependencies({
      executeBrowser: vi.fn(async () => ({
        scenarios,
        modelIds: ['claude-sonnet-4-6'],
        usage: {
          onboardingGenerationCalls: 7,
          agentCalls: 8,
          observedPipelineCostUsd: 0.11,
        },
      })),
    })

    await expect(
      runCurrentReleaseAcceptance(validOptions(), dependencies),
    ).rejects.toThrow('CURRENT_RELEASE_ACCEPTANCE_REJECTED')
    const report = vi.mocked(dependencies.writeReport).mock.calls[0]![0]
    expect(report.accepted).toBe(false)
    expect(dependencies.removeRegistry).not.toHaveBeenCalled()
  })

  it('reports a stable combined failure when browser and cleanup both fail', async () => {
    const secret = 'Synthetic-user-A-password-123!'
    const dependencies = validDependencies({
      executeBrowser: vi.fn(async () => {
        throw new Error(`browser ${secret}`)
      }),
      cleanup: vi.fn(async () => {
        throw new Error(`cleanup ${secret}`)
      }),
    })

    await expect(
      runCurrentReleaseAcceptance(validOptions(), dependencies),
    ).rejects.toThrow(
      'CURRENT_RELEASE_BROWSER_AND_CLEANUP_FAILED',
    )
    expect(dependencies.removeRegistry).not.toHaveBeenCalled()
  })

  it('fails closed when child usage exceeds the fixed reservation counts', async () => {
    const dependencies = validDependencies({
      executeBrowser: vi.fn(async () => ({
        scenarios: passingScenarios(),
        modelIds: ['claude-sonnet-4-6'],
        usage: {
          onboardingGenerationCalls: 8,
          agentCalls: 8,
          observedPipelineCostUsd: 0.11,
        },
      })),
    })

    await expect(
      runCurrentReleaseAcceptance(validOptions(), dependencies),
    ).rejects.toThrow('CURRENT_RELEASE_BROWSER_USAGE_INVALID')
    expect(dependencies.cleanup).toHaveBeenCalledTimes(1)
    expect(dependencies.removeRegistry).not.toHaveBeenCalled()
  })
})
