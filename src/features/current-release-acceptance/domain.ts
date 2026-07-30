import { z } from 'zod'
import {
  assertSyntheticDataPolicy,
  runIdSchema,
} from '../synthetic-acceptance/domain'

export const CURRENT_RELEASE_MAX_COST_USD = 2
export const CURRENT_RELEASE_COST_STOP_USD = 1.5
export const CURRENT_RELEASE_PIPELINE_RESERVATION_LABEL = 'pipeline'

export const currentReleaseBrowserScenarios = [
  'auth.registration',
  'auth.session',
  'onboarding.express',
  'onboarding.path-a',
  'onboarding.path-b',
  'onboarding.deep',
  'agents.six',
  'agents.legal-positive',
  'agents.legal-negative',
  'studio.property',
  'studio.fact',
  'studio.source',
  'studio.proposals',
  'studio.history',
  'isolation.cross-user',
  'admin.agent-toggle',
  'account.export',
  'onboarding.reset',
  'ui.mobile',
  'account.delete',
] as const

export const currentReleaseScenarios = [
  ...currentReleaseBrowserScenarios,
  'cleanup.complete',
] as const

export const currentReleaseScenarioSchema = z.enum(
  currentReleaseScenarios,
)

const safeErrorCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[A-Z][A-Z0-9_:-]*$/)

export const currentReleaseScenarioResultSchema = z
  .object({
    name: currentReleaseScenarioSchema,
    status: z.enum(['passed', 'failed']),
    durationMs: z.number().int().nonnegative().max(3_600_000),
    errorCode: safeErrorCodeSchema.optional(),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.status === 'passed' && result.errorCode !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['errorCode'],
        message: 'CURRENT_RELEASE_ERROR_CODE_UNEXPECTED',
      })
    }
    if (result.status === 'failed' && result.errorCode === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['errorCode'],
        message: 'CURRENT_RELEASE_ERROR_CODE_REQUIRED',
      })
    }

    try {
      assertSyntheticDataPolicy(result)
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'SYNTHETIC_DATA_POLICY_VIOLATION',
      })
    }
  })

export const currentReleaseScenarioResultsSchema = z
  .array(currentReleaseScenarioResultSchema)
  .length(
    currentReleaseScenarios.length,
    'CURRENT_RELEASE_SCENARIOS_INVALID',
  )
  .superRefine((scenarios, context) => {
    const names = scenarios.map((scenario) => scenario.name)
    if (new Set(names).size !== names.length) {
      context.addIssue({
        code: 'custom',
        message: 'CURRENT_RELEASE_SCENARIOS_NOT_UNIQUE',
      })
    }

    if (
      currentReleaseScenarios.some(
        (requiredScenario) => !names.includes(requiredScenario),
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'CURRENT_RELEASE_SCENARIOS_INVALID',
      })
    }
  })

export const currentReleaseRunIdSchema = runIdSchema

export type CurrentReleaseScenario = z.infer<
  typeof currentReleaseScenarioSchema
>
export type ScenarioResult = z.infer<
  typeof currentReleaseScenarioResultSchema
>

export type AcceptanceCostGuard = {
  reserve(label: string, estimatedUsd: number): void
  recordObservedPipelineCost(usd: number): void
  totalEstimatedUsd(): number
  observedPipelineCostUsd(): number
  isStopped(): boolean
}

type AcceptanceCostGuardOptions = {
  stopBeforeUsd: number
  maxUsd: number
}

const USD_MICROUNITS = 1_000_000
const safeCostLabelPattern = /^[a-z][a-z0-9.-]{0,79}$/

export function createAcceptanceCostGuard({
  stopBeforeUsd,
  maxUsd,
}: AcceptanceCostGuardOptions): AcceptanceCostGuard {
  if (
    !Number.isFinite(stopBeforeUsd) ||
    !Number.isFinite(maxUsd) ||
    stopBeforeUsd <= 0 ||
    maxUsd <= 0 ||
    stopBeforeUsd > CURRENT_RELEASE_COST_STOP_USD ||
    maxUsd > CURRENT_RELEASE_MAX_COST_USD ||
    stopBeforeUsd > maxUsd
  ) {
    throw new Error('CURRENT_RELEASE_COST_LIMIT_INVALID')
  }

  const stopBeforeMicrounits =
    usdToConservativeMicrounits(stopBeforeUsd)
  const maxMicrounits = usdToConservativeMicrounits(maxUsd)
  const reservations = new Map<string, number>()
  let observedPipelineMicrounits: number | null = null
  let stopped = false

  function totalMicrounits(
    pipelineObservedMicrounits = observedPipelineMicrounits,
  ): number {
    let total = 0
    for (const [label, amount] of reservations) {
      if (
        label === CURRENT_RELEASE_PIPELINE_RESERVATION_LABEL &&
        pipelineObservedMicrounits !== null
      ) {
        continue
      }
      total += amount
    }
    return total + (pipelineObservedMicrounits ?? 0)
  }

  return {
    reserve(label, estimatedUsd) {
      if (stopped) {
        throw new Error('CURRENT_RELEASE_COST_STOP')
      }
      if (!safeCostLabelPattern.test(label)) {
        throw new Error('CURRENT_RELEASE_COST_LABEL_INVALID')
      }
      if (reservations.has(label)) {
        throw new Error('CURRENT_RELEASE_COST_LABEL_DUPLICATE')
      }
      if (!Number.isFinite(estimatedUsd) || estimatedUsd <= 0) {
        throw new Error('CURRENT_RELEASE_COST_ESTIMATE_INVALID')
      }
      if (estimatedUsd > stopBeforeUsd) {
        stopped = true
        throw new Error('CURRENT_RELEASE_COST_STOP')
      }

      const estimatedMicrounits =
        usdToConservativeMicrounits(estimatedUsd)
      if (
        estimatedMicrounits <= 0 ||
        totalMicrounits() + estimatedMicrounits >
          stopBeforeMicrounits
      ) {
        stopped = true
        throw new Error('CURRENT_RELEASE_COST_STOP')
      }

      reservations.set(label, estimatedMicrounits)
    },

    recordObservedPipelineCost(usd) {
      if (!Number.isFinite(usd) || usd < 0) {
        stopped = true
        throw new Error('CURRENT_RELEASE_PIPELINE_COST_INVALID')
      }
      if (
        !reservations.has(
          CURRENT_RELEASE_PIPELINE_RESERVATION_LABEL,
        )
      ) {
        stopped = true
        throw new Error(
          'CURRENT_RELEASE_PIPELINE_RESERVATION_MISSING',
        )
      }
      if (observedPipelineMicrounits !== null) {
        stopped = true
        throw new Error(
          'CURRENT_RELEASE_PIPELINE_COST_ALREADY_RECORDED',
        )
      }
      if (usd > maxUsd) {
        stopped = true
        throw new Error('CURRENT_RELEASE_COST_MAX')
      }

      const candidateObservedMicrounits =
        usdToConservativeMicrounits(usd)
      const total = totalMicrounits(candidateObservedMicrounits)
      if (total > maxMicrounits) {
        stopped = true
        throw new Error('CURRENT_RELEASE_COST_MAX')
      }
      observedPipelineMicrounits = candidateObservedMicrounits
      if (total > stopBeforeMicrounits) {
        stopped = true
      }
    },

    totalEstimatedUsd() {
      return fromMicrounits(totalMicrounits())
    },

    observedPipelineCostUsd() {
      return fromMicrounits(observedPipelineMicrounits ?? 0)
    },

    isStopped() {
      return stopped
    },
  }
}

export function usdToConservativeMicrounits(usd: number): number {
  if (!Number.isFinite(usd)) {
    throw new Error('CURRENT_RELEASE_COST_OVERFLOW')
  }

  const scaled = usd * USD_MICROUNITS
  if (!Number.isFinite(scaled)) {
    throw new Error('CURRENT_RELEASE_COST_OVERFLOW')
  }

  const floatingPointTolerance =
    Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4
  const microunits = Math.ceil(scaled - floatingPointTolerance)
  if (
    !Number.isFinite(microunits) ||
    !Number.isSafeInteger(microunits)
  ) {
    throw new Error('CURRENT_RELEASE_COST_OVERFLOW')
  }
  return microunits
}

function fromMicrounits(microunits: number): number {
  return microunits / USD_MICROUNITS
}
