import { describe, expect, it, vi } from 'vitest'
import {
  createChildCostBudget,
  parseChildBudgetContract,
} from '../../../e2e/current-release/budget'

describe('per-run child cost budget', () => {
  it('uses the actual runner maximum and stops before a costly call', async () => {
    const budget = createChildCostBudget(
      parseChildBudgetContract(
        JSON.stringify({
          maxUsd: 0.5,
          stopBeforeUsd: 0.5,
          unitCosts: {
            onboardingGenerationUsd: 0.06,
            agentCallUsd: 0.08,
            sourcePipelineUsd: 0.25,
          },
        }),
      ),
    )
    const costlyCall = vi.fn(async () => 'called')

    await budget.runBefore('sourcePipeline', costlyCall)
    await budget.runBefore('agent', costlyCall)
    await budget.runBefore('agent', costlyCall)
    await budget.runBefore('agent', costlyCall)
    await expect(
      budget.runBefore('onboardingGeneration', costlyCall),
    ).rejects.toThrow('CURRENT_RELEASE_COST_STOP')

    expect(costlyCall).toHaveBeenCalledTimes(4)
    expect(budget.snapshot()).toEqual({
      onboardingGenerationCalls: 0,
      agentCalls: 3,
      sourcePipelineCalls: 1,
      reservedUsd: 0.49,
    })
  })

  it('rejects a hardcoded or invalid child maximum', () => {
    expect(() =>
      parseChildBudgetContract(
        JSON.stringify({
          maxUsd: 0,
          stopBeforeUsd: 0,
          unitCosts: {
            onboardingGenerationUsd: 0.06,
            agentCallUsd: 0.08,
            sourcePipelineUsd: 0.25,
          },
        }),
      ),
    ).toThrow('CURRENT_RELEASE_BUDGET_INVALID')
  })
})
