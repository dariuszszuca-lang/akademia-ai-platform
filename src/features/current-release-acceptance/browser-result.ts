import { z } from 'zod'
import type { SyntheticCleanupRegistry } from '../synthetic-acceptance/cleanup-registry'
import { safeModelIdSchema } from '../../lib/model-id'
import {
  currentReleaseScenarioResultSchema,
  currentReleaseScenarios,
  type ScenarioResult,
} from './domain'

export const currentReleaseBrowserScenarios =
  currentReleaseScenarios.filter(
    (name) => name !== 'cleanup.complete',
  )

export type CurrentReleaseBrowserScenario =
  (typeof currentReleaseBrowserScenarios)[number]

export const currentReleaseBrowserScenarioSchema = z.enum(
  currentReleaseBrowserScenarios as [
    CurrentReleaseBrowserScenario,
    ...CurrentReleaseBrowserScenario[],
  ],
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
    sourceIds: z.array(uuidSchema).max(20),
    storageKeys: z.array(z.string().min(1).max(1024)).max(40),
    kvKeys: z.array(z.string().min(1).max(512)).max(20),
    adminAgentState: z
      .object({
        agentId: z
          .string()
          .regex(/^[a-z][a-z0-9-]*$/)
          .max(80),
        enabled: z.boolean(),
      })
      .strict()
      .nullable(),
  })
  .strict()

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
): BrowserExecutionResult {
  assertSafeBrowserResultValues(value)
  return browserExecutionResultSchema.parse(
    value,
  ) as BrowserExecutionResult
}

function assertSafeBrowserResultValues(input: unknown): void {
  const visited = new WeakSet<object>()

  function inspect(value: unknown): void {
    if (typeof value === 'string') {
      if (
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
