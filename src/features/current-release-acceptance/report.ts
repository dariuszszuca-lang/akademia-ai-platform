import { z } from 'zod'
import { safeModelIdSchema } from '../../lib/model-id'
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

function exactCostSchema(maxUsd: number) {
  return z
    .number()
    .nonnegative()
    .max(maxUsd)
    .superRefine((value, context) => {
      if (usdToExactMicrounits(value) === null) {
        context.addIssue({
          code: 'custom',
          message: 'CURRENT_RELEASE_COST_PRECISION_INVALID',
        })
      }
    })
}

const contractualCostSchema = exactCostSchema(
  CURRENT_RELEASE_MAX_COST_USD,
)
const CURRENT_RELEASE_MAX_COST_MICROUNITS =
  CURRENT_RELEASE_MAX_COST_USD * 1_000_000

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
      .regex(
        /^dpl_[A-Za-z0-9]{12,64}$/,
        'CURRENT_RELEASE_DEPLOYMENT_ID_INVALID',
      ),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    scenarios: currentReleaseScenarioResultsSchema,
    modelIds: z.array(safeModelIdSchema).max(20),
    estimatedAnthropicCostUsd: exactCostSchema(
      CURRENT_RELEASE_COST_STOP_USD,
    ),
    observedPipelineCostUsd: contractualCostSchema,
    providerCostUsd: contractualCostSchema,
    cleanup: cleanupSchema,
    accepted: z.boolean(),
  })
  .strict()
  .superRefine((report, context) => {
    try {
      assertSafeReportValues(report)
    } catch (error) {
      context.addIssue({
        code: 'custom',
        message:
          error instanceof Error
            ? error.message
            : 'CURRENT_RELEASE_REPORT_SECRET_VALUE',
      })
    }

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

    const estimatedAnthropicCostMicrounits =
      usdToExactMicrounits(
        report.estimatedAnthropicCostUsd,
      )
    const observedPipelineCostMicrounits =
      usdToExactMicrounits(report.observedPipelineCostUsd)
    const providerCostMicrounits =
      usdToExactMicrounits(report.providerCostUsd)
    if (
      estimatedAnthropicCostMicrounits === null ||
      observedPipelineCostMicrounits === null ||
      providerCostMicrounits === null
    ) {
      return
    }
    const combinedCostMicrounits =
      estimatedAnthropicCostMicrounits +
      observedPipelineCostMicrounits

    if (
      combinedCostMicrounits >
      CURRENT_RELEASE_MAX_COST_MICROUNITS
    ) {
      context.addIssue({
        code: 'custom',
        message: 'CURRENT_RELEASE_REPORT_COST_INVALID',
      })
    }
    if (providerCostMicrounits !== combinedCostMicrounits) {
      context.addIssue({
        code: 'custom',
        path: ['providerCostUsd'],
        message: 'CURRENT_RELEASE_PROVIDER_COST_MISMATCH',
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
    if (report.accepted && report.modelIds.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['modelIds'],
        message: 'CURRENT_RELEASE_ACCEPTED_MODEL_IDS_REQUIRED',
      })
    }
  })

export type CurrentReleaseReport = z.infer<
  typeof currentReleaseReportSchema
>

export function createCurrentReleaseReport(
  input: unknown,
): CurrentReleaseReport {
  assertSafeReportValues(input)
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
  // `accepted` is the operator's manual final verdict. The schema only
  // enforces the fail-closed direction: true is forbidden when objective
  // scenario or cleanup evidence is incomplete.
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

const forbiddenSecretValuePatterns = [
  /sk_live_[A-Za-z0-9_-]{4,}/i,
  /sk-ant-[A-Za-z0-9_-]{4,}/i,
  /pcsk_[A-Za-z0-9_-]{4,}/i,
  /AKIA[A-Z0-9]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
]

function assertSafeReportValues(input: unknown): void {
  const visited = new WeakSet<object>()

  function inspect(value: unknown): void {
    if (typeof value === 'string') {
      if (
        forbiddenSecretValuePatterns.some((pattern) =>
          pattern.test(value),
        )
      ) {
        throw new Error('CURRENT_RELEASE_REPORT_SECRET_VALUE')
      }
      return
    }
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

function usdToExactMicrounits(usd: number): number | null {
  if (!Number.isFinite(usd)) return null

  const scaled = usd * 1_000_000
  if (!Number.isFinite(scaled)) return null

  const nearestMicrounit = Math.round(scaled)
  const floatingPointTolerance =
    Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4
  if (
    !Number.isSafeInteger(nearestMicrounit) ||
    Math.abs(scaled - nearestMicrounit) >
      floatingPointTolerance
  ) {
    return null
  }
  return nearestMicrounit
}
