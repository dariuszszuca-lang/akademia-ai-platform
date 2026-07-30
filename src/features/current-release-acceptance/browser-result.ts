import { z } from 'zod'
import {
  accountDeletionReceiptSchema,
  type SyntheticCleanupRegistry,
} from '../synthetic-acceptance/cleanup-registry'
import { safeModelIdSchema } from '../../lib/model-id'
import {
  currentReleaseScenarioResultSchema,
  currentReleaseBrowserScenarios,
  type ScenarioResult,
} from './domain'

export { currentReleaseBrowserScenarios }

export type CurrentReleaseBrowserScenario =
  (typeof currentReleaseBrowserScenarios)[number]

export const currentReleaseBrowserScenarioSchema = z.enum(
  currentReleaseBrowserScenarios,
)

const uuidSchema = z.string().uuid()
const cognitoSubjectSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )

export const browserRegistryUpdateSchema = z
  .object({
    releaseUsers: z
      .array(
        z
          .object({
            role: z.enum(['a', 'b']),
            username: z.string().max(180),
            cognitoSub: cognitoSubjectSchema.nullable(),
          })
          .strict(),
      )
      .length(2),
    organizationId: uuidSchema.nullable(),
    organizationPrefix: z.string().max(240).nullable(),
    projectIds: z.array(uuidSchema).max(20),
    factIds: z.array(uuidSchema).max(100).optional(),
    sourceJobIds: z.array(uuidSchema).max(100).optional(),
    proposalIds: z.array(uuidSchema).max(100).optional(),
    sourceIds: z.array(uuidSchema).max(20),
    storageKeys: z.array(z.string().min(1).max(1024)).max(40),
    kvKeys: z.array(z.string().min(1).max(512)).max(20),
    adminAgentState: z
      .object({
        agentId: z.literal('publikacja'),
        enabled: z.boolean(),
      })
      .strict()
      .nullable(),
    accountDeletionReceipts: z
      .array(accountDeletionReceiptSchema)
      .max(2)
      .optional(),
    ephemeralStateExpiresAt: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((update, context) => {
    for (const [field, values] of [
      ['projectIds', update.projectIds],
      ['factIds', update.factIds ?? []],
      ['sourceJobIds', update.sourceJobIds ?? []],
      ['proposalIds', update.proposalIds ?? []],
      ['sourceIds', update.sourceIds],
      ['storageKeys', update.storageKeys],
      ['kvKeys', update.kvKeys],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'CURRENT_RELEASE_REGISTRY_UPDATE_DUPLICATE',
        })
      }
    }
    const receiptRoles = (update.accountDeletionReceipts ?? []).map(
      (receipt) => receipt.role,
    )
    if (new Set(receiptRoles).size !== receiptRoles.length) {
      context.addIssue({
        code: 'custom',
        path: ['accountDeletionReceipts'],
        message:
          'CURRENT_RELEASE_DELETION_RECEIPT_ROLE_DUPLICATE',
      })
    }
  })

const browserScenarioResultSchema =
  currentReleaseScenarioResultSchema.refine(
    (
      scenario,
    ): scenario is ScenarioResult & {
      name: CurrentReleaseBrowserScenario
    } => scenario.name !== 'cleanup.complete',
    'CURRENT_RELEASE_BROWSER_SCENARIO_INVALID',
  )

const browserScenarioResultsSchema = z
  .array(browserScenarioResultSchema)
  .length(
    currentReleaseBrowserScenarios.length,
    'CURRENT_RELEASE_BROWSER_SCENARIOS_INVALID',
  )
  .superRefine((scenarios, context) => {
    const names = scenarios.map((scenario) => scenario.name)
    if (new Set(names).size !== names.length) {
      context.addIssue({
        code: 'custom',
        message: 'CURRENT_RELEASE_BROWSER_SCENARIOS_NOT_UNIQUE',
      })
    }
    if (
      currentReleaseBrowserScenarios.some(
        (requiredScenario) => !names.includes(requiredScenario),
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'CURRENT_RELEASE_BROWSER_SCENARIOS_INVALID',
      })
    }
  })

export const browserExecutionResultSchema = z
  .object({
    scenarios: browserScenarioResultsSchema,
    modelIds: z
      .array(safeModelIdSchema)
      .max(20)
      .superRefine((modelIds, context) => {
        if (new Set(modelIds).size !== modelIds.length) {
          context.addIssue({
            code: 'custom',
            message: 'CURRENT_RELEASE_MODEL_IDS_NOT_UNIQUE',
          })
        }
      }),
    usage: z
      .object({
        onboardingGenerationCalls: z.number().int().nonnegative(),
        agentCalls: z.number().int().nonnegative(),
        sourcePipelineCalls: z.union([z.literal(0), z.literal(1)]),
        observedPipelineCostUsd: z.number().nonnegative(),
      })
      .strict(),
    registryUpdate: browserRegistryUpdateSchema.optional(),
  })
  .strict()

export type BrowserRegistryUpdate = z.infer<
  typeof browserRegistryUpdateSchema
> & {
  releaseUsers: SyntheticCleanupRegistry['releaseUsers']
  adminAgentState: SyntheticCleanupRegistry['adminAgentState']
}

export type BrowserExecutionResult = {
  scenarios: ScenarioResult[]
  modelIds: string[]
  usage: {
    onboardingGenerationCalls: number
    agentCalls: number
    sourcePipelineCalls: 0 | 1
    observedPipelineCostUsd: number
  }
  registryUpdate?: BrowserRegistryUpdate
}

const forbiddenBrowserResultFields = new Set([
  'prompt',
  'response',
  'password',
  'token',
  'cookie',
  'signedurl',
  'filename',
  'acceptancesecret',
  'signature',
  'nonce',
  'expiresat',
])

const forbiddenSecretValuePatterns = [
  /^[A-Za-z0-9_-]{43,128}$/,
  /sk_live_[A-Za-z0-9_-]{4,}/i,
  /sk-ant-[A-Za-z0-9_-]{4,}/i,
  /pcsk_[A-Za-z0-9_-]{4,}/i,
  /AKIA[A-Z0-9]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
]

export function parseBrowserExecutionResult(
  value: unknown,
  forbiddenValues: readonly string[] = [],
): BrowserExecutionResult {
  assertSafeBrowserResultValues(value, forbiddenValues)
  return browserExecutionResultSchema.parse(
    value,
  ) as BrowserExecutionResult
}

function assertSafeBrowserResultValues(
  input: unknown,
  forbiddenValues: readonly string[],
): void {
  if (
    forbiddenValues.length > 16 ||
    forbiddenValues.some(
      (value) =>
        typeof value !== 'string' ||
        value.length < 1 ||
        value.length > 1024,
    )
  ) {
    throw new Error(
      'CURRENT_RELEASE_BROWSER_RESULT_FORBIDDEN_VALUES_INVALID',
    )
  }
  const uniqueForbiddenValues = [...new Set(forbiddenValues)]
  const visited = new WeakSet<object>()

  function inspect(value: unknown): void {
    if (typeof value === 'string') {
      if (
        uniqueForbiddenValues.some((secret) =>
          value.includes(secret),
        ) ||
        forbiddenSecretValuePatterns.some((pattern) =>
          pattern.test(value),
        )
      ) {
        throw new Error(
          'CURRENT_RELEASE_BROWSER_RESULT_SECRET_VALUE',
        )
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
      const normalizedKey = key
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
      if (forbiddenBrowserResultFields.has(normalizedKey)) {
        throw new Error(
          'CURRENT_RELEASE_BROWSER_RESULT_FORBIDDEN_FIELD',
        )
      }
      inspect(nestedValue)
    }
  }

  inspect(input)
}
