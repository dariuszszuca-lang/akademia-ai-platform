import { describe, expect, it, vi } from 'vitest'
import {
  runProductionSynthetic,
  type ProductionSyntheticDependencies,
} from './production-runner'

const options = {
  allowProductionSynthetic: true,
  profile: 'akademia-ai',
  region: 'eu-central-1',
  baseUrl: 'https://akademia-ai-platform.vercel.app',
  maxCostUsd: 3,
  workspaceRoot: '/workspace',
}

describe('production synthetic acceptance guards', () => {
  it('refuses a missing production flag before AWS or HTTP', async () => {
    const dependencies = createDependencies()

    await expect(
      runProductionSynthetic(
        { ...options, allowProductionSynthetic: false },
        dependencies,
      ),
    ).rejects.toThrow('PRODUCTION_SYNTHETIC_NOT_ALLOWED')
    expect(dependencies.aws.getCallerIdentity).not.toHaveBeenCalled()
    expect(dependencies.http.createSession).not.toHaveBeenCalled()
  })

  it('refuses a different AWS account before HTTP', async () => {
    const dependencies = createDependencies()
    vi.mocked(dependencies.aws.getCallerIdentity).mockResolvedValue({
      Account: '021655150975',
      Arn: 'arn:aws:iam::021655150975:user/wrong',
    })

    await expect(
      runProductionSynthetic(options, dependencies),
    ).rejects.toThrow('REFUSING_AWS_ACCOUNT')
    expect(dependencies.http.createSession).not.toHaveBeenCalled()
  })

  it('refuses the wrong profile, region, URL or raised cost limit', async () => {
    for (const override of [
      { profile: 'ai-team' },
      { region: 'us-east-1' },
      { baseUrl: 'https://preview.vercel.app' },
      { maxCostUsd: 3.01 },
    ]) {
      const dependencies = createDependencies()
      await expect(
        runProductionSynthetic(
          { ...options, ...override },
          dependencies,
        ),
      ).rejects.toThrow()
      expect(dependencies.aws.getCallerIdentity).not.toHaveBeenCalled()
    }
  })

  it('always cleans only the registered run after a corpus failure', async () => {
    const dependencies = createDependencies()
    const cleanupCalls: Array<[string, string]> = []
    vi.mocked(dependencies.http.executeCorpus).mockImplementation(async ({
      registry,
    }) => {
      registry.cognitoSub =
        '55555555-5555-4555-8555-555555555555'
      registry.organizationId =
        '11111111-1111-4111-8111-111111111111'
      registry.organizationPrefix =
        'originals/organizations/11111111-1111-4111-8111-111111111111/'
      throw new Error('material_7_failed')
    })
    vi.mocked(dependencies.http.deleteAccount).mockImplementation(
      async (_cookie, userId) => {
        cleanupCalls.push(['delete-account', userId])
      },
    )
    vi.mocked(dependencies.aws.deleteCognitoUser).mockImplementation(
      async (username) => {
        cleanupCalls.push(['delete-cognito-user', username])
      },
    )
    vi.mocked(dependencies.aws.verifyS3Empty).mockImplementation(async (prefix) => {
      cleanupCalls.push(['verify-s3-empty', prefix])
      return 0
    })
    let dlqChecks = 0
    vi.mocked(dependencies.aws.checkDlq).mockImplementation(async () => {
      dlqChecks += 1
      if (dlqChecks > 1) cleanupCalls.push(['check-dlq', '0'])
      return 0
    })
    let alarmChecks = 0
    vi.mocked(dependencies.aws.checkAlarms).mockImplementation(async () => {
      alarmChecks += 1
      if (alarmChecks > 1) cleanupCalls.push(['check-alarms', '0'])
      return 0
    })

    await expect(
      runProductionSynthetic(options, dependencies),
    ).rejects.toThrow('material_7_failed')

    expect(cleanupCalls).toEqual([
      ['delete-account', '55555555-5555-4555-8555-555555555555'],
      [
        'delete-cognito-user',
        'synthetic-acceptance-syn-20260728T210000Z-deadbeef@example.invalid',
      ],
      [
        'verify-s3-empty',
        'originals/organizations/11111111-1111-4111-8111-111111111111/',
      ],
      ['check-dlq', '0'],
      ['check-alarms', '0'],
    ])
    expect(dependencies.registry.remove).toHaveBeenCalledWith(
      'syn-20260728T210000Z-deadbeef',
    )
  })
})

function createDependencies(): ProductionSyntheticDependencies {
  return {
    now: () => new Date('2026-07-28T21:00:00.000Z'),
    createRunId: () => 'syn-20260728T210000Z-deadbeef',
    createPassword: () => 'not-persisted',
    aws: {
      getConfiguredRegion: vi.fn(async () => 'eu-central-1'),
      getCallerIdentity: vi.fn(async () => ({
        Account: '261965598943',
        Arn: 'arn:aws:iam::261965598943:user/akademia-wojtka-admin-darek',
      })),
      checkDlq: vi.fn(async () => 0),
      checkAlarms: vi.fn(async () => 0),
      createCognitoUser: vi.fn(async () => ({
        cognitoSub: '55555555-5555-4555-8555-555555555555',
      })),
      authenticateCognitoUser: vi.fn(async () => ({
        accessToken: 'not-inspected',
      })),
      deleteCognitoUser: vi.fn(async () => {}),
      verifyS3Empty: vi.fn(async () => 0),
      purgeRegisteredObjects: vi.fn(async () => {}),
    },
    http: {
      createSession: vi.fn(async () => ({
        cookie: 'not-inspected',
        userId: '55555555-5555-4555-8555-555555555555',
      })),
      executeCorpus: vi.fn(async () => ({
        observations: [],
        jobs: [],
        modelIds: [],
      })),
      deleteAccount: vi.fn(async () => {}),
      verifyAccountAbsent: vi.fn(async () => true),
    },
    registry: {
      save: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    },
    writeReport: vi.fn(async () => {}),
  }
}
