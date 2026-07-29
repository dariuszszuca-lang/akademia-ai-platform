import { describe, expect, it, vi } from 'vitest'
import {
  createChildCostBudget,
  parseChildBudgetContract,
} from '../../../e2e/current-release/budget'

describe('per-run child cost budget', () => {
  it('reserves the full 9/8/1 contract at 1.43 USD and stops the next 1.51 USD call', async () => {
    const budget = createChildCostBudget(
      parseChildBudgetContract(
        JSON.stringify({
          maxUsd: 2,
          stopBeforeUsd: 1.5,
          unitCosts: {
            onboardingGenerationUsd: 0.06,
            agentCallUsd: 0.08,
            sourcePipelineUsd: 0.25,
          },
        }),
      ),
    )
    const paidCall = vi.fn(async () => 'called')

    for (let index = 0; index < 9; index += 1) {
      await budget.runBefore('onboardingGeneration', paidCall)
    }
    for (let index = 0; index < 8; index += 1) {
      await budget.runBefore('agent', paidCall)
    }
    await budget.runBefore('sourcePipeline', paidCall)

    expect(budget.snapshot()).toEqual({
      onboardingGenerationCalls: 9,
      agentCalls: 8,
      sourcePipelineCalls: 1,
      reservedUsd: 1.43,
    })
    await expect(
      budget.runBefore('agent', paidCall),
    ).rejects.toThrow('CURRENT_RELEASE_COST_STOP')
    expect(paidCall).toHaveBeenCalledTimes(18)
    expect(budget.snapshot().reservedUsd + 0.08).toBe(1.51)
  })

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
