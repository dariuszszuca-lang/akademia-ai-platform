import { existsSync, writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  buildPlaywrightChildEnvironment,
  createDefaultBrowserExecutor,
  CURRENT_RELEASE_COST_RESERVATIONS,
  CURRENT_RELEASE_PRODUCTION_URL,
  runCurrentReleaseAcceptance,
  validateBrowserUsage,
  type CurrentReleaseRunnerDependencies,
  type CurrentReleaseRunnerOptions,
} from './runner'
import { getCurrentReleasePaths } from '../../../e2e/current-release/journal'
import { createSyntheticCleanupRegistry } from '../synthetic-acceptance/cleanup-registry'
import {
  type ScenarioResult,
} from './domain'
import {
  currentReleaseBrowserScenarios,
  type BrowserExecutionResult,
} from './browser-result'

const runId = 'syn-20260729T220000Z-deadbeef'
const adminPassword = 'Synthetic-admin-password-123!'
const acceptanceSecret = 's'.repeat(43)

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
    acceptanceSecret,
    workspaceRoot: '/synthetic/workspace',
    ...overrides,
  }
}

function passingScenarios(): ScenarioResult[] {
  return currentReleaseBrowserScenarios.map((name) => ({
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
        onboardingGenerationCalls: 9,
        agentCalls: 8,
        sourcePipelineCalls: 1 as const,
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
    [
      { acceptanceSecret: undefined },
      'CURRENT_RELEASE_ACCEPTANCE_SECRET_MISSING',
    ],
    [
      { acceptanceSecret: 'weak' },
      'CURRENT_RELEASE_ACCEPTANCE_SECRET_INVALID',
    ],
    [
      {
        adminPassword: `Ab1_${'s'.repeat(39)}`,
        acceptanceSecret: `Ab1_${'s'.repeat(39)}`,
      },
      'CURRENT_RELEASE_ACCEPTANCE_SECRET_INVALID',
    ],
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
      CURRENT_RELEASE_ACCEPTANCE_SECRET: acceptanceSecret,
      CURRENT_RELEASE_USER_A_PASSWORD:
        'Synthetic-user-A-password-123!',
      CURRENT_RELEASE_USER_B_PASSWORD:
        'Synthetic-user-B-password-456!',
    })
    const savedRegistry = vi.mocked(dependencies.saveRegistry).mock
      .calls[0]![0]
    const serializedRegistry = JSON.stringify(savedRegistry)
    expect(serializedRegistry).not.toContain(adminPassword)
    expect(serializedRegistry).not.toContain(acceptanceSecret)
    expect(serializedRegistry).not.toContain('password')
    expect(serializedRegistry).not.toContain('token')

    const report = vi.mocked(dependencies.writeReport).mock.calls[0]![0]
    const serializedReport = JSON.stringify(report)
    expect(serializedReport).not.toContain(adminPassword)
    expect(serializedReport).not.toContain(acceptanceSecret)
    expect(serializedReport).not.toContain(
      'Synthetic-user-A-password-123!',
    )
    expect(report.scenarios).toHaveLength(20)
    expect(report.scenarios.at(-1)).toEqual({
      name: 'cleanup.complete',
      status: 'passed',
      durationMs: 0,
    })
    expect(report.estimatedAnthropicCostUsd).toBe(1.18)
    expect(report.observedPipelineCostUsd).toBe(0.11)
    expect(report.providerCostUsd).toBe(1.29)
    expect(CURRENT_RELEASE_COST_RESERVATIONS).toMatchObject({
      onboardingGenerationCalls: 9,
      agentCalls: 8,
    })
  })

  it('passes the actual per-run maximum to the child and validates actual usage', async () => {
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
          onboardingGenerationCalls: 0,
          agentCalls: 3,
          sourcePipelineCalls: 1 as const,
          observedPipelineCostUsd: 0.1,
        },
      })),
    })

    await expect(
      runCurrentReleaseAcceptance(
        validOptions({ maxCostUsd: 0.5 }),
        dependencies,
      ),
    ).rejects.toThrow('CURRENT_RELEASE_ACCEPTANCE_REJECTED')

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
    const report = vi.mocked(dependencies.writeReport).mock.calls[0]![0]
    expect(report.estimatedAnthropicCostUsd).toBe(0.24)
    expect(report.providerCostUsd).toBe(0.34)
  })

  it('replaces the pipeline reservation with a higher observed cost under the real maximum', async () => {
    const dependencies = validDependencies({
      executeBrowser: vi.fn(async () => ({
        scenarios: passingScenarios(),
        modelIds: ['claude-sonnet-4-6'],
        usage: {
          onboardingGenerationCalls: 9,
          agentCalls: 8,
          sourcePipelineCalls: 1 as const,
          observedPipelineCostUsd: 0.3,
        },
      })),
    })

    const report = await runCurrentReleaseAcceptance(
      validOptions(),
      dependencies,
    )

    expect(report.estimatedAnthropicCostUsd).toBe(1.18)
    expect(report.observedPipelineCostUsd).toBe(0.3)
    expect(report.providerCostUsd).toBe(1.48)
  })

  it('fails closed when the observed replacement makes the real total exceed max', async () => {
    const dependencies = validDependencies({
      executeBrowser: vi.fn(async () => ({
        scenarios: passingScenarios(),
        modelIds: ['claude-sonnet-4-6'],
        usage: {
          onboardingGenerationCalls: 9,
          agentCalls: 8,
          sourcePipelineCalls: 1 as const,
          observedPipelineCostUsd: 1,
        },
      })),
    })

    await expect(
      runCurrentReleaseAcceptance(validOptions(), dependencies),
    ).rejects.toThrow('CURRENT_RELEASE_BROWSER_USAGE_INVALID')
    expect(dependencies.cleanup).toHaveBeenCalledTimes(1)
    expect(dependencies.writeReport).not.toHaveBeenCalled()
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
        CURRENT_RELEASE_ACCEPTANCE_SECRET: acceptanceSecret,
        CURRENT_RELEASE_UNRELATED_SECRET: 'must-not-pass',
      },
    )

    expect(environment).toEqual({
      PATH: '/usr/bin',
      HOME: '/synthetic/home',
      TMPDIR: '/tmp',
      LANG: 'pl_PL.UTF-8',
      CURRENT_RELEASE_RUN_ID: runId,
      CURRENT_RELEASE_BASE_URL: CURRENT_RELEASE_PRODUCTION_URL,
      CURRENT_RELEASE_ACCEPTANCE_SECRET: acceptanceSecret,
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
    let capturedArguments: string[] = []
    const executeBrowser = createDefaultBrowserExecutor(
      workspaceRoot,
      {
        processEnvironment: {
          PATH: '/usr/bin',
          HOME: '/synthetic/home',
          AWS_ACCESS_KEY_ID: 'synthetic-access-key',
          STRIPE_SECRET_KEY: 'synthetic-stripe',
        },
        executeFile: (_file, args, options) => {
          capturedArguments = args
          capturedEnvironment = options.env
          writeFileSync(
            paths.resultPath,
            JSON.stringify({
              scenarios: passingScenarios(),
              modelIds: ['claude-sonnet-4-6'],
              usage: {
                onboardingGenerationCalls: 0,
                agentCalls: 0,
                sourcePipelineCalls: 0 as const,
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
        CURRENT_RELEASE_ACCEPTANCE_SECRET: acceptanceSecret,
      },
      costReservations: {
        onboardingGenerationUsd: 0.06,
        onboardingGenerationCalls: 9,
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
      CURRENT_RELEASE_ACCEPTANCE_SECRET: acceptanceSecret,
    })
    expect(capturedArguments.join(' ')).not.toContain(
      acceptanceSecret,
    )
  })

  it('reads a safe failed-scenario result even when Playwright exits nonzero', async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), 'release-browser-result-'),
    )
    const paths = getCurrentReleasePaths(workspaceRoot, runId)
    const registry = createSyntheticCleanupRegistry({
      runId,
      startedAt: '2026-07-29T22:00:00.000Z',
    })
    const scenarios = passingScenarios()
    scenarios[0] = {
      ...scenarios[0]!,
      status: 'failed',
      errorCode: 'AUTH_REGISTRATION_FAILED',
    }
    const executeBrowser = createDefaultBrowserExecutor(
      workspaceRoot,
      {
        executeFile: () => {
          writeFileSync(
            paths.resultPath,
            JSON.stringify({
              scenarios,
              modelIds: [],
              usage: {
                onboardingGenerationCalls: 0,
                agentCalls: 0,
                sourcePipelineCalls: 0 as const,
                observedPipelineCostUsd: 0,
              },
            }),
          )
          throw new Error('synthetic playwright failure')
        },
      },
    )

    await expect(
      executeBrowser({
        runId,
        baseUrl: CURRENT_RELEASE_PRODUCTION_URL,
        childEnv: {
          CURRENT_RELEASE_RUN_ID: runId,
        },
        costReservations: CURRENT_RELEASE_COST_RESERVATIONS,
        resultPath: paths.resultPath,
        registryPath: paths.registryPath,
        paths,
        registry,
      }),
    ).resolves.toMatchObject({ scenarios })
  })

  it('rejects an all-passed result when Playwright exits nonzero', async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), 'release-browser-process-'),
    )
    const paths = getCurrentReleasePaths(workspaceRoot, runId)
    const registry = createSyntheticCleanupRegistry({
      runId,
      startedAt: '2026-07-29T22:00:00.000Z',
    })
    const executeBrowser = createDefaultBrowserExecutor(
      workspaceRoot,
      {
        executeFile: () => {
          writeFileSync(
            paths.resultPath,
            JSON.stringify({
              scenarios: passingScenarios(),
              modelIds: [],
              usage: {
                onboardingGenerationCalls: 9,
                agentCalls: 8,
                sourcePipelineCalls: 1 as const,
                observedPipelineCostUsd: 0.1,
              },
            }),
          )
          throw new Error('synthetic playwright process failure')
        },
      },
    )

    await expect(
      executeBrowser({
        runId,
        baseUrl: CURRENT_RELEASE_PRODUCTION_URL,
        childEnv: {
          CURRENT_RELEASE_RUN_ID: runId,
        },
        costReservations: CURRENT_RELEASE_COST_RESERVATIONS,
        resultPath: paths.resultPath,
        registryPath: paths.registryPath,
        paths,
        registry,
      }),
    ).rejects.toThrow('CURRENT_RELEASE_BROWSER_PROCESS_FAILED')
  })

  it('rejects a runner guard embedded in an otherwise valid browser result', async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), 'release-browser-guard-'),
    )
    const paths = getCurrentReleasePaths(workspaceRoot, runId)
    const registry = createSyntheticCleanupRegistry({
      runId,
      startedAt: '2026-07-29T22:00:00.000Z',
    })
    const runnerGuard = 'g'.repeat(43)
    const executeBrowser = createDefaultBrowserExecutor(
      workspaceRoot,
      {
        executeFile: () => {
          writeFileSync(
            paths.resultPath,
            JSON.stringify({
              scenarios: passingScenarios(),
              modelIds: [],
              usage: {
                onboardingGenerationCalls: 9,
                agentCalls: 8,
                sourcePipelineCalls: 1 as const,
                observedPipelineCostUsd: 0.1,
              },
              registryUpdate: {
                releaseUsers: [
                  {
                    role: 'a',
                    username:
                      `synthetic-${runnerGuard}@example.invalid`,
                    cognitoSub: null,
                  },
                  {
                    role: 'b',
                    username:
                      `synthetic-release-${runId}-b@example.invalid`,
                    cognitoSub: null,
                  },
                ],
                organizationId: null,
                organizationPrefix: null,
                projectIds: [],
                factIds: [],
                sourceJobIds: [],
                proposalIds: [],
                sourceIds: [],
                storageKeys: [],
                kvKeys: [],
                adminAgentState: null,
                accountDeletionReceipts: [],
                ephemeralStateExpiresAt: null,
              },
            }),
          )
          return ''
        },
      },
    )

    await expect(
      executeBrowser({
        runId,
        baseUrl: CURRENT_RELEASE_PRODUCTION_URL,
        childEnv: {
          CURRENT_RELEASE_RUN_ID: runId,
          CURRENT_RELEASE_RUNNER_GUARD: runnerGuard,
        },
        costReservations: CURRENT_RELEASE_COST_RESERVATIONS,
        resultPath: paths.resultPath,
        registryPath: paths.registryPath,
        paths,
        registry,
      }),
    ).rejects.toThrow('CURRENT_RELEASE_BROWSER_RESULT_INVALID')
  })

  it('removes a secret-bearing invalid result and guard marker on every exit', async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), 'release-browser-cleanup-'),
    )
    const paths = getCurrentReleasePaths(workspaceRoot, runId)
    const registry = createSyntheticCleanupRegistry({
      runId,
      startedAt: '2026-07-29T22:00:00.000Z',
    })
    const secret = 'Synthetic-admin-password-marker-789!'
    const executeBrowser = createDefaultBrowserExecutor(
      workspaceRoot,
      {
        executeFile: () => {
          writeFileSync(paths.guardMarkerPath, '{}')
          writeFileSync(
            paths.resultPath,
            `{"invalid":"${secret}"}`,
          )
          return ''
        },
      },
    )

    let caught = ''
    try {
      await executeBrowser({
        runId,
        baseUrl: CURRENT_RELEASE_PRODUCTION_URL,
        childEnv: {
          CURRENT_RELEASE_RUN_ID: runId,
          ADMIN_PASSWORD: secret,
        },
        costReservations: {
          onboardingGenerationUsd: 0.06,
          onboardingGenerationCalls: 9,
          agentCallUsd: 0.08,
          agentCalls: 8,
          sourcePipelineUsd: 0.25,
        },
        resultPath: paths.resultPath,
        registryPath: paths.registryPath,
        paths,
        registry,
      })
    } catch (error) {
      caught = error instanceof Error ? error.message : String(error)
    }

    expect(caught).toBe('CURRENT_RELEASE_BROWSER_RESULT_INVALID')
    expect(caught).not.toContain(secret)
    expect(existsSync(paths.resultPath)).toBe(false)
    expect(existsSync(paths.guardMarkerPath)).toBe(false)
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
    expect(cleanupInput).toMatchObject({
      baseUrl: CURRENT_RELEASE_PRODUCTION_URL,
      adminPassword,
      credentials: [
        {
          role: 'a',
          username: `synthetic-release-${runId}-a@example.invalid`,
          password: secret,
        },
        {
          role: 'b',
          username: `synthetic-release-${runId}-b@example.invalid`,
          password: 'Synthetic-user-B-password-456!',
        },
      ],
    })
    expect(cleanupInput.registry.runId).toBe(runId)
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
      .calls[0]![0].registry
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
          onboardingGenerationCalls: 9,
          agentCalls: 8,
          sourcePipelineCalls: 1 as const,
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
          factIds: ['66666666-6666-4666-8666-666666666666'],
          sourceJobIds: [
            '77777777-7777-4777-8777-777777777777',
          ],
          proposalIds: ['88888888-8888-4888-8888-888888888888'],
          sourceIds: ['55555555-5555-4555-8555-555555555555'],
          storageKeys: [
            'originals/organizations/33333333-3333-4333-8333-333333333333/source.pdf',
          ],
          kvKeys: [`user:${subjectA}:profil`],
          adminAgentState: {
            agentId: 'publikacja' as const,
            enabled: true,
          },
          accountDeletionReceipts: [
            {
              role: 'a' as const,
              ok: true as const,
              sourceObjects: 2,
              propertyStudio: 1 as const,
              accountKeys: 5 as const,
            },
          ],
          ephemeralStateExpiresAt: 1_785_362_465,
        },
      })),
    })

    await runCurrentReleaseAcceptance(validOptions(), dependencies)

    const cleanupRegistry = vi.mocked(dependencies.cleanup).mock
      .calls[0]![0].registry
    expect(cleanupRegistry.releaseUsers[0]?.cognitoSub).toBe(subjectA)
    expect(cleanupRegistry.projectIds).toEqual([
      '44444444-4444-4444-8444-444444444444',
    ])
    expect(cleanupRegistry.factIds).toEqual([
      '66666666-6666-4666-8666-666666666666',
    ])
    expect(cleanupRegistry.sourceJobIds).toEqual([
      '77777777-7777-4777-8777-777777777777',
    ])
    expect(cleanupRegistry.proposalIds).toEqual([
      '88888888-8888-4888-8888-888888888888',
    ])
    expect(cleanupRegistry.accountDeletionReceipts).toHaveLength(1)
    expect(cleanupRegistry.ephemeralStateExpiresAt).toBe(
      1_785_362_465,
    )
    expect(dependencies.saveRegistry).toHaveBeenCalledTimes(2)
  })

  it('rejects a known secret embedded in a registry update before merge and acceptance', async () => {
    const organizationId =
      '33333333-3333-4333-8333-333333333333'
    const organizationPrefix =
      `originals/organizations/${organizationId}/`
    const dependencies = validDependencies({
      executeBrowser: vi.fn(async () => ({
        scenarios: passingScenarios(),
        modelIds: ['claude-sonnet-4-6'],
        usage: {
          onboardingGenerationCalls: 9,
          agentCalls: 8,
          sourcePipelineCalls: 1 as const,
          observedPipelineCostUsd: 0.11,
        },
        registryUpdate: {
          releaseUsers: [
            {
              role: 'a' as const,
              username:
                `synthetic-release-${runId}-a@example.invalid`,
              cognitoSub: null,
            },
            {
              role: 'b' as const,
              username:
                `synthetic-release-${runId}-b@example.invalid`,
              cognitoSub: null,
            },
          ],
          organizationId,
          organizationPrefix,
          projectIds: [],
          sourceIds: [],
          storageKeys: [
            `${organizationPrefix}${adminPassword}.pdf`,
          ],
          kvKeys: [],
          adminAgentState: null,
        },
      })),
    })

    await expect(
      runCurrentReleaseAcceptance(validOptions(), dependencies),
    ).rejects.toThrow('CURRENT_RELEASE_BROWSER_RESULT_INVALID')

    expect(dependencies.cleanup).toHaveBeenCalledTimes(1)
    expect(dependencies.writeReport).not.toHaveBeenCalled()
    expect(dependencies.saveRegistry).toHaveBeenCalledTimes(1)
  })

  it('rejects a browser snapshot that conflicts with newer atomic journal evidence', async () => {
    let diskRegistry:
      | Parameters<CurrentReleaseRunnerDependencies['saveRegistry']>[0]
      | null = null
    const dependencies = validDependencies({
      saveRegistry: vi.fn(async (value) => {
        diskRegistry = structuredClone(value)
      }),
      loadRegistry: vi.fn(async () =>
        diskRegistry ? structuredClone(diskRegistry) : null,
      ),
      executeBrowser: vi.fn(async (input) => {
        const journal = structuredClone(input.registry)
        journal.adminAgentState = {
          agentId: 'publikacja',
          enabled: true,
        }
        await dependencies.saveRegistry(journal)
        return {
          scenarios: passingScenarios(),
          modelIds: ['claude-sonnet-4-6'],
          usage: {
            onboardingGenerationCalls: 9,
            agentCalls: 8,
            sourcePipelineCalls: 1 as const,
            observedPipelineCostUsd: 0.11,
          },
          registryUpdate: {
            releaseUsers: structuredClone(journal.releaseUsers),
            organizationId: null,
            organizationPrefix: null,
            projectIds: [],
            sourceIds: [],
            storageKeys: [],
            kvKeys: [],
            adminAgentState: {
              agentId: 'publikacja' as const,
              enabled: false,
            },
          },
        }
      }),
    })

    await expect(
      runCurrentReleaseAcceptance(validOptions(), dependencies),
    ).rejects.toThrow('CURRENT_RELEASE_BROWSER_FAILED')

    expect(
      vi.mocked(dependencies.cleanup).mock.calls[0]![0].registry
        .adminAgentState,
    ).toEqual({
      agentId: 'publikacja',
      enabled: true,
    })
  })

  it('measures cleanup duration for the runner-owned final scenario', async () => {
    const dependencies = validDependencies({
      now: vi
        .fn()
        .mockReturnValueOnce(
          new Date('2026-07-29T22:00:00.000Z'),
        )
        .mockReturnValueOnce(
          new Date('2026-07-29T22:01:00.000Z'),
        )
        .mockReturnValueOnce(
          new Date('2026-07-29T22:01:02.500Z'),
        )
        .mockReturnValue(
          new Date('2026-07-29T22:01:03.000Z'),
        ),
    })

    const report = await runCurrentReleaseAcceptance(
      validOptions(),
      dependencies,
    )

    expect(report.scenarios.at(-1)).toEqual({
      name: 'cleanup.complete',
      status: 'passed',
      durationMs: 2_500,
    })
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
    expect(report.scenarios.at(-1)).toEqual({
      name: 'cleanup.complete',
      status: 'failed',
      durationMs: 0,
      errorCode: 'CURRENT_RELEASE_CLEANUP_INCOMPLETE',
    })
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

  it('writes a rejected report and removes the registry after verified complete cleanup', async () => {
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
          onboardingGenerationCalls: 9,
          agentCalls: 8,
          sourcePipelineCalls: 1 as const,
          observedPipelineCostUsd: 0.11,
        },
      })),
    })

    await expect(
      runCurrentReleaseAcceptance(validOptions(), dependencies),
    ).rejects.toThrow('CURRENT_RELEASE_ACCEPTANCE_REJECTED')
    const report = vi.mocked(dependencies.writeReport).mock.calls[0]![0]
    expect(report.accepted).toBe(false)
    expect(dependencies.removeRegistry).toHaveBeenCalledWith(runId)
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
          onboardingGenerationCalls: 10,
          agentCalls: 8,
          sourcePipelineCalls: 1 as const,
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

  it('rejects successful browser scenarios unless usage is exactly 9/8/1', () => {
    const result: BrowserExecutionResult = {
      scenarios: passingScenarios(),
      modelIds: ['claude-sonnet-4-6'],
      usage: {
        onboardingGenerationCalls: 8,
        agentCalls: 8,
        sourcePipelineCalls: 1 as const,
        observedPipelineCostUsd: 0.1,
      },
    }

    expect(() => validateBrowserUsage(result, 2)).toThrow(
      'CURRENT_RELEASE_BROWSER_USAGE_INVALID',
    )
  })

  it('allows bounded truthful partial usage after a browser scenario failure', () => {
    const scenarios = passingScenarios()
    scenarios[0] = {
      ...scenarios[0]!,
      status: 'failed',
      errorCode: 'AUTH_REGISTRATION_FAILED',
    }
    const result: BrowserExecutionResult = {
      scenarios,
      modelIds: [],
      usage: {
        onboardingGenerationCalls: 2,
        agentCalls: 1,
        sourcePipelineCalls: 0 as const,
        observedPipelineCostUsd: 0,
      },
    }

    expect(() => validateBrowserUsage(result, 0.5)).not.toThrow()
  })

  it.each([
    {
      onboardingGenerationCalls: -1,
      agentCalls: 0,
      sourcePipelineCalls: 0,
      observedPipelineCostUsd: 0,
    },
    {
      onboardingGenerationCalls: 9,
      agentCalls: 9,
      sourcePipelineCalls: 1,
      observedPipelineCostUsd: 0,
    },
    {
      onboardingGenerationCalls: 9,
      agentCalls: 8,
      sourcePipelineCalls: 0,
      observedPipelineCostUsd: 0.01,
    },
    {
      onboardingGenerationCalls: 9,
      agentCalls: 8,
      sourcePipelineCalls: 1,
      observedPipelineCostUsd: 1,
    },
  ])('rejects invalid or over-contract browser usage %o', (usage) => {
    const scenarios = passingScenarios()
    scenarios[0] = {
      ...scenarios[0]!,
      status: 'failed',
      errorCode: 'AUTH_REGISTRATION_FAILED',
    }
    const result = {
      scenarios,
      modelIds: [],
      usage,
    } as BrowserExecutionResult

    expect(() => validateBrowserUsage(result, 2)).toThrow(
      'CURRENT_RELEASE_BROWSER_USAGE_INVALID',
    )
  })
})
