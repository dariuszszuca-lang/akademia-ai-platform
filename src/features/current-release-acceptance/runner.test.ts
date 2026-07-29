import { describe, expect, it, vi } from 'vitest'
import {
  CURRENT_RELEASE_PRODUCTION_URL,
  runCurrentReleaseAcceptance,
  type CurrentReleaseRunnerDependencies,
  type CurrentReleaseRunnerOptions,
} from './runner'
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
    removeRegistry: vi.fn(async () => undefined),
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

  it('preserves the registry when a cleanup check fails', async () => {
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

    const report = await runCurrentReleaseAcceptance(
      validOptions(),
      dependencies,
    )

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

  it('preserves the recovery registry when any scenario fails', async () => {
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

    const report = await runCurrentReleaseAcceptance(
      validOptions(),
      dependencies,
    )

    expect(report.accepted).toBe(false)
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
