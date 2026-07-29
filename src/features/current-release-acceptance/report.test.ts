import { describe, expect, it } from 'vitest'
import {
  createCurrentReleaseReport,
  renderCurrentReleaseReportMarkdown,
  serializeCurrentReleaseReport,
} from './report'
import {
  currentReleaseScenarios,
  type ScenarioResult,
} from './domain'

const syntheticStripeSecretMarker = [
  'sk',
  'live',
  'deadbeef',
].join('_')
const syntheticAnthropicSecretMarker =
  ['sk', 'ant', 'synthetic', 'deadbeef'].join('-')
const syntheticAwsAccessKeyMarker = [
  'AK',
  'IA',
  'SYNTHETIC',
  'DEADBEE',
].join('')

function validInput() {
  return {
    contractVersion: 'current-release-acceptance-v1' as const,
    runId: 'syn-20260729T200000Z-deadbeef',
    baseUrl: 'https://studio.example.invalid',
    commitSha: 'a'.repeat(40),
    deploymentId: 'dpl_AbCdEf123456',
    startedAt: '2026-07-29T20:00:00.000Z',
    completedAt: '2026-07-29T20:01:00.000Z',
    scenarios: currentReleaseScenarios.map((name) => ({
      name,
      status: 'passed' as const,
      durationMs: 10,
    })),
    modelIds: [
      'claude-sonnet-4-20250514',
      'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
    ],
    estimatedAnthropicCostUsd: 0.8,
    observedPipelineCostUsd: 0.1,
    providerCostUsd: 0.9,
    cleanup: {
      databaseEmpty: true,
      cognitoUsersAbsent: true,
      kvKeysAbsent: true,
      s3VersionsRemaining: 0,
      adminStateRestored: true,
      dlqMessagesVisible: 0,
      alarmsNotOk: 0,
    },
    accepted: true,
  }
}

describe('safe current release acceptance report', () => {
  it('serializes only the closed validated report contract', () => {
    const input = validInput()
    const report = createCurrentReleaseReport(input)
    const json = serializeCurrentReleaseReport(report)
    const markdown = renderCurrentReleaseReportMarkdown(report)

    expect(JSON.parse(json)).toEqual(input)
    expect(markdown).toContain('syn-20260729T200000Z-deadbeef')
    expect(markdown).toContain('Zaakceptowany: tak')
    expect(markdown).toContain('auth.registration: passed')
    expect(markdown).not.toContain('prompt')
    expect(markdown).not.toContain('response')
  })

  it.each([
    'password',
    'token',
    'cookie',
    'prompt',
    'response',
    'fileName',
    'signedUrl',
  ])('rejects forbidden field %s at nested levels', (fieldName) => {
    const input = validInput()
    const scenarios: unknown[] = [...input.scenarios]
    scenarios[0] = {
      ...input.scenarios[0],
      [fieldName]: 'must-not-be-reported',
    }

    expect(() =>
      createCurrentReleaseReport({
        ...input,
        scenarios,
      }),
    ).toThrow('CURRENT_RELEASE_REPORT_FORBIDDEN_FIELD')
  })

  it('rejects secret-shaped values in model and deployment identifiers', () => {
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        modelIds: [syntheticStripeSecretMarker],
      }),
    ).toThrow('CURRENT_RELEASE_REPORT_SECRET_VALUE')
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        deploymentId: syntheticAnthropicSecretMarker,
      }),
    ).toThrow('CURRENT_RELEASE_REPORT_SECRET_VALUE')
  })

  it('rejects secret-shaped values in URL query and userinfo', () => {
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        baseUrl:
          `https://studio.example.invalid/?key=${syntheticAwsAccessKeyMarker}`,
      }),
    ).toThrow('CURRENT_RELEASE_REPORT_SECRET_VALUE')
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        baseUrl:
          `https://${syntheticStripeSecretMarker}@studio.example.invalid`,
      }),
    ).toThrow('CURRENT_RELEASE_REPORT_SECRET_VALUE')
  })

  it('rejects secret-shaped values before JSON or Markdown serialization', () => {
    const report = createCurrentReleaseReport(validInput())
    const polluted = {
      ...report,
      modelIds: [syntheticAnthropicSecretMarker],
    }

    expect(() =>
      serializeCurrentReleaseReport(polluted as typeof report),
    ).toThrow('CURRENT_RELEASE_REPORT_SECRET_VALUE')
    expect(() =>
      renderCurrentReleaseReportMarkdown(
        polluted as typeof report,
      ),
    ).toThrow('CURRENT_RELEASE_REPORT_SECRET_VALUE')
  })

  it('keeps real safe model identifiers valid', () => {
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        modelIds: [
          'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
        ],
      }),
    ).not.toThrow()
  })

  it('rejects unexpected root and cleanup fields', () => {
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        traceId: 'trace-1',
      }),
    ).toThrow()
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        cleanup: {
          ...validInput().cleanup,
          sourceCount: 1,
        },
      }),
    ).toThrow()
  })

  it('revalidates runtime values before every serialization', () => {
    const report = createCurrentReleaseReport(validInput())
    const polluted = {
      ...report,
      cleanup: {
        ...report.cleanup,
        token: 'must-not-be-reported',
      },
    }

    expect(() =>
      serializeCurrentReleaseReport(
        polluted as typeof report,
      ),
    ).toThrow('CURRENT_RELEASE_REPORT_FORBIDDEN_FIELD')
    expect(() =>
      renderCurrentReleaseReportMarkdown(
        polluted as typeof report,
      ),
    ).toThrow('CURRENT_RELEASE_REPORT_FORBIDDEN_FIELD')
  })

  it('requires sensible URL, dates, commit and deployment identifiers', () => {
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        baseUrl: 'javascript:alert(1)',
      }),
    ).toThrow()
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        baseUrl: 'https://user:pass@studio.example.invalid/path?token=x',
      }),
    ).toThrow()
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        commitSha: 'main',
      }),
    ).toThrow()
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        deploymentId: '../deployment',
      }),
    ).toThrow()
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        completedAt: '2026-07-29T19:59:59.000Z',
      }),
    ).toThrow('CURRENT_RELEASE_REPORT_TIME_INVALID')
  })

  it('keeps model identifiers bounded, safe and unique', () => {
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        modelIds: ['model id with spaces'],
      }),
    ).toThrow()
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        modelIds: ['safe-model', 'safe-model'],
      }),
    ).toThrow('CURRENT_RELEASE_MODEL_IDS_NOT_UNIQUE')
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        modelIds: Array.from(
          { length: 21 },
          (_, index) => `safe-model-${index}`,
        ),
      }),
    ).toThrow()
  })

  it.each([
    ['estimatedAnthropicCostUsd', 1.51],
    ['observedPipelineCostUsd', 2.01],
    ['providerCostUsd', 2.01],
    ['providerCostUsd', Number.NaN],
  ] as const)(
    'rejects invalid contractual cost %s=%s',
    (field, value) => {
      expect(() =>
        createCurrentReleaseReport({
          ...validInput(),
          [field]: value,
        }),
      ).toThrow()
    },
  )

  it('rejects a combined estimate and observed pipeline cost above 2 USD', () => {
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        estimatedAnthropicCostUsd: 1.5,
        observedPipelineCostUsd: 0.51,
      }),
    ).toThrow('CURRENT_RELEASE_REPORT_COST_INVALID')
  })

  it('binds provider cost to estimated and observed components', () => {
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        providerCostUsd: 0,
      }),
    ).toThrow('CURRENT_RELEASE_PROVIDER_COST_MISMATCH')
  })

  it('compares provider cost without IEEE-754 sum surprises', () => {
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        estimatedAnthropicCostUsd: 0.1,
        observedPipelineCostUsd: 0.2,
        providerCostUsd: 0.1 + 0.2,
      }),
    ).not.toThrow()
  })

  it.each([
    {
      estimatedAnthropicCostUsd: 0.0000004,
      observedPipelineCostUsd: 0.0000004,
      providerCostUsd: 0.0000008,
    },
    {
      estimatedAnthropicCostUsd: 0.0000004,
      observedPipelineCostUsd: 0,
      providerCostUsd: 0.0000009,
    },
  ])(
    'rejects sub-microunit report arithmetic: %o',
    (costs) => {
      expect(() =>
        createCurrentReleaseReport({
          ...validInput(),
          ...costs,
        }),
      ).toThrow('CURRENT_RELEASE_COST_PRECISION_INVALID')
    },
  )

  it('rejects accepted=true when any scenario failed', () => {
    const input = validInput()
    const scenarios: ScenarioResult[] = [...input.scenarios]
    scenarios[0] = {
      ...scenarios[0]!,
      status: 'failed',
      errorCode: 'AUTH_SESSION_FAILED',
    }

    expect(() =>
      createCurrentReleaseReport({ ...input, scenarios }),
    ).toThrow('CURRENT_RELEASE_ACCEPTED_INVALID')
  })

  it.each([
    ['databaseEmpty', false],
    ['cognitoUsersAbsent', false],
    ['kvKeysAbsent', false],
    ['s3VersionsRemaining', 1],
    ['adminStateRestored', false],
    ['dlqMessagesVisible', 1],
    ['alarmsNotOk', 1],
  ] as const)(
    'rejects accepted=true when cleanup field %s is dirty',
    (field, value) => {
      const input = validInput()

      expect(() =>
        createCurrentReleaseReport({
          ...input,
          cleanup: {
            ...input.cleanup,
            [field]: value,
          },
        }),
      ).toThrow('CURRENT_RELEASE_ACCEPTED_INVALID')
    },
  )

  it('allows a fail-closed report with accepted=false', () => {
    const input = validInput()
    const scenarios: ScenarioResult[] = [...input.scenarios]
    scenarios[0] = {
      ...scenarios[0]!,
      status: 'failed',
      errorCode: 'AUTH_SESSION_FAILED',
    }

    expect(() =>
      createCurrentReleaseReport({
        ...input,
        scenarios,
        accepted: false,
      }),
    ).not.toThrow()
  })

  it('requires a model identifier for an accepted report', () => {
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        modelIds: [],
      }),
    ).toThrow('CURRENT_RELEASE_ACCEPTED_MODEL_IDS_REQUIRED')
  })

  it('allows a clean report to retain the manual accepted=false verdict', () => {
    expect(() =>
      createCurrentReleaseReport({
        ...validInput(),
        modelIds: [],
        accepted: false,
      }),
    ).not.toThrow()
  })
})
