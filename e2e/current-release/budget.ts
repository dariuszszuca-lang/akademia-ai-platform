import { z } from 'zod'

const unitCostsSchema = z
  .object({
    onboardingGenerationUsd: z.literal(0.06),
    agentCallUsd: z.literal(0.08),
    sourcePipelineUsd: z.literal(0.25),
  })
  .strict()

const childBudgetContractSchema = z
  .object({
    maxUsd: z.number().positive().max(2),
    // Mirrors CURRENT_RELEASE_COST_STOP_USD (marker-retry headroom).
    stopBeforeUsd: z.number().positive().max(1.7),
    unitCosts: unitCostsSchema,
  })
  .strict()
  .superRefine((contract, context) => {
    if (contract.stopBeforeUsd > contract.maxUsd) {
      context.addIssue({
        code: 'custom',
        path: ['stopBeforeUsd'],
        message: 'stopBeforeUsd exceeds maxUsd',
      })
    }
  })

export type ChildBudgetContract = Readonly<
  z.infer<typeof childBudgetContractSchema>
>

export type ChildCostKind =
  | 'onboardingGeneration'
  | 'agent'
  | 'sourcePipeline'

export type ChildCostSnapshot = {
  onboardingGenerationCalls: number
  agentCalls: number
  sourcePipelineCalls: number
  reservedUsd: number
}

export function parseChildBudgetContract(
  value: string,
): ChildBudgetContract {
  try {
    const parsed = childBudgetContractSchema.parse(JSON.parse(value))
    return Object.freeze({
      ...parsed,
      unitCosts: Object.freeze({ ...parsed.unitCosts }),
    })
  } catch {
    throw new Error('CURRENT_RELEASE_BUDGET_INVALID')
  }
}

export function createChildCostBudget(
  contract: ChildBudgetContract,
) {
  const parsed = parseChildBudgetContract(JSON.stringify(contract))
  const counters: ChildCostSnapshot = {
    onboardingGenerationCalls: 0,
    agentCalls: 0,
    sourcePipelineCalls: 0,
    reservedUsd: 0,
  }

  return {
    async runBefore<T>(
      kind: ChildCostKind,
      callback: () => Promise<T>,
    ): Promise<T> {
      const unitCost = getUnitCost(parsed, kind)
      const candidate = roundUsd(counters.reservedUsd + unitCost)
      if (
        candidate > parsed.stopBeforeUsd ||
        candidate > parsed.maxUsd
      ) {
        throw new Error('CURRENT_RELEASE_COST_STOP')
      }

      incrementCounter(counters, kind)
      counters.reservedUsd = candidate
      return callback()
    },

    snapshot(): ChildCostSnapshot {
      return { ...counters }
    },
  }
}

function getUnitCost(
  contract: ChildBudgetContract,
  kind: ChildCostKind,
): number {
  if (kind === 'onboardingGeneration') {
    return contract.unitCosts.onboardingGenerationUsd
  }
  if (kind === 'agent') return contract.unitCosts.agentCallUsd
  return contract.unitCosts.sourcePipelineUsd
}

function incrementCounter(
  counters: ChildCostSnapshot,
  kind: ChildCostKind,
): void {
  if (kind === 'onboardingGeneration') {
    counters.onboardingGenerationCalls += 1
  } else if (kind === 'agent') {
    counters.agentCalls += 1
  } else {
    counters.sourcePipelineCalls += 1
  }
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}
