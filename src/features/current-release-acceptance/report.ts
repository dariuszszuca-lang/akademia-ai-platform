import { z } from 'zod'
import { assertSyntheticDataPolicy } from '../synthetic-acceptance/domain'
import {
  CURRENT_RELEASE_COST_STOP_USD,
  CURRENT_RELEASE_MAX_COST_USD,
  currentReleaseRunIdSchema,
  currentReleaseScenarioResultsSchema,
} from './domain'

const safeBaseUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .superRefine((value, context) => {
    const url = new URL(value)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username !== '' ||
      url.password !== '' ||
      url.search !== '' ||
      url.hash !== '' ||
      (url.pathname !== '' && url.pathname !== '/')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'CURRENT_RELEASE_BASE_URL_INVALID',
      })
    }
  })

const safeModelIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/)

const contractualCostSchema = z
  .number()
  .nonnegative()
  .max(CURRENT_RELEASE_MAX_COST_USD)

const cleanupSchema = z
  .object({
    databaseEmpty: z.boolean(),
    cognitoUsersAbsent: z.boolean(),
    kvKeysAbsent: z.boolean(),
    s3VersionsRemaining: z.number().int().nonnegative(),
    adminStateRestored: z.boolean(),
    dlqMessagesVisible: z.number().int().nonnegative(),
    alarmsNotOk: z.number().int().nonnegative(),
  })
  .strict()

export const currentReleaseReportSchema = z
  .object({
    contractVersion: z.literal('current-release-acceptance-v1'),
    runId: currentReleaseRunIdSchema,
    baseUrl: safeBaseUrlSchema,
    commitSha: z.string().regex(/^[a-f0-9]{40}$/i),
    deploymentId: z
      .string()
      .min(6)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    scenarios: currentReleaseScenarioResultsSchema,
    modelIds: z.array(safeModelIdSchema).max(20),
    estimatedAnthropicCostUsd: contractualCostSchema.max(
      CURRENT_RELEASE_COST_STOP_USD,
    ),
    observedPipelineCostUsd: contractualCostSchema,
    providerCostUsd: contractualCostSchema,
    cleanup: cleanupSchema,
    accepted: z.boolean(),
  })
  .strict()
  .superRefine((report, context) => {
    if (
      new Date(report.completedAt).getTime() <
      new Date(report.startedAt).getTime()
    ) {
      context.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: 'CURRENT_RELEASE_REPORT_TIME_INVALID',
      })
    }

    if (new Set(report.modelIds).size !== report.modelIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['modelIds'],
        message: 'CURRENT_RELEASE_MODEL_IDS_NOT_UNIQUE',
      })
    }

    if (
      report.estimatedAnthropicCostUsd +
        report.observedPipelineCostUsd >
      CURRENT_RELEASE_MAX_COST_USD
    ) {
      context.addIssue({
        code: 'custom',
        message: 'CURRENT_RELEASE_REPORT_COST_INVALID',
      })
    }

    try {
      assertSyntheticDataPolicy(report.scenarios)
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'SYNTHETIC_DATA_POLICY_VIOLATION',
      })
    }

    if (report.accepted && !isAcceptedResult(report)) {
      context.addIssue({
        code: 'custom',
        path: ['accepted'],
        message: 'CURRENT_RELEASE_ACCEPTED_INVALID',
      })
    }
  })

export type CurrentReleaseReport = z.infer<
  typeof currentReleaseReportSchema
>

export function createCurrentReleaseReport(
  input: unknown,
): CurrentReleaseReport {
  assertNoForbiddenReportFields(input)
  return currentReleaseReportSchema.parse(input)
}

export function serializeCurrentReleaseReport(
  report: CurrentReleaseReport,
): string {
  const parsed = createCurrentReleaseReport(report)
  return `${JSON.stringify(parsed, null, 2)}\n`
}

export function renderCurrentReleaseReportMarkdown(
  report: CurrentReleaseReport,
): string {
  const parsed = createCurrentReleaseReport(report)
  const modelIds =
    parsed.modelIds.length > 0 ? parsed.modelIds.join(', ') : 'brak'

  return [
    '# Odbiór bieżącego wydania Property Intelligence Studio',
    '',
    `- Przebieg: \`${parsed.runId}\``,
    `- Adres: ${parsed.baseUrl}`,
    `- Commit: \`${parsed.commitSha}\``,
    `- Deployment: \`${parsed.deploymentId}\``,
    `- Start: ${parsed.startedAt}`,
    `- Koniec: ${parsed.completedAt}`,
    `- Modele: ${modelIds}`,
    `- Koszt estymowany Anthropic: ${parsed.estimatedAnthropicCostUsd.toFixed(6)} USD`,
    `- Koszt pipeline: ${parsed.observedPipelineCostUsd.toFixed(6)} USD`,
    `- Koszt dostawców: ${parsed.providerCostUsd.toFixed(6)} USD`,
    `- Zaakceptowany: ${parsed.accepted ? 'tak' : 'nie'}`,
    '',
    '## Scenariusze',
    '',
    ...parsed.scenarios.map(
      (scenario) =>
        `- ${scenario.name}: ${scenario.status} (${scenario.durationMs} ms)${
          scenario.errorCode ? ` [${scenario.errorCode}]` : ''
        }`,
    ),
    '',
    '## Sprzątanie',
    '',
    `- Baza pusta: ${parsed.cleanup.databaseEmpty ? 'tak' : 'nie'}`,
    `- Użytkownicy Cognito nie istnieją: ${
      parsed.cleanup.cognitoUsersAbsent ? 'tak' : 'nie'
    }`,
    `- Klucze KV nie istnieją: ${
      parsed.cleanup.kvKeysAbsent ? 'tak' : 'nie'
    }`,
    `- Wersje S3: ${parsed.cleanup.s3VersionsRemaining}`,
    `- Stan administratora przywrócony: ${
      parsed.cleanup.adminStateRestored ? 'tak' : 'nie'
    }`,
    `- Wiadomości DLQ: ${parsed.cleanup.dlqMessagesVisible}`,
    `- Alarmy poza OK: ${parsed.cleanup.alarmsNotOk}`,
    '',
  ].join('\n')
}

function isAcceptedResult(
  report: z.infer<typeof currentReleaseReportSchema>,
): boolean {
  return (
    report.scenarios.every((scenario) => scenario.status === 'passed') &&
    report.cleanup.databaseEmpty &&
    report.cleanup.cognitoUsersAbsent &&
    report.cleanup.kvKeysAbsent &&
    report.cleanup.s3VersionsRemaining === 0 &&
    report.cleanup.adminStateRestored &&
    report.cleanup.dlqMessagesVisible === 0 &&
    report.cleanup.alarmsNotOk === 0
  )
}

const forbiddenReportFields = new Set([
  'password',
  'token',
  'cookie',
  'prompt',
  'response',
  'filename',
  'signedurl',
])

function assertNoForbiddenReportFields(input: unknown): void {
  const visited = new WeakSet<object>()

  function inspect(value: unknown): void {
    if (!value || typeof value !== 'object') return
    if (visited.has(value)) return
    visited.add(value)

    if (Array.isArray(value)) {
      value.forEach(inspect)
      return
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      if (forbiddenReportFields.has(key.toLowerCase())) {
        throw new Error('CURRENT_RELEASE_REPORT_FORBIDDEN_FIELD')
      }
      inspect(nestedValue)
    }
  }

  inspect(input)
}
