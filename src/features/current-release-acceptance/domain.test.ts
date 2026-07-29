import { describe, expect, it } from 'vitest'
import {
  createAcceptanceCostGuard,
  currentReleaseScenarioResultsSchema,
  currentReleaseScenarios,
  type ScenarioResult,
} from './domain'

const requiredScenarios = [
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
  'account.delete',
  'ui.mobile',
  'cleanup.complete',
] as const

function passingScenarios(): ScenarioResult[] {
  return requiredScenarios.map((name) => ({
    name,
    status: 'passed',
    durationMs: 10,
  }))
}

describe('current release scenario contract', () => {
  it('publishes the exact required scenario catalog', () => {
    expect(currentReleaseScenarios).toEqual(requiredScenarios)
    expect(
      currentReleaseScenarioResultsSchema.parse(passingScenarios()),
    ).toHaveLength(requiredScenarios.length)
  })

  it('rejects a missing scenario', () => {
    expect(() =>
      currentReleaseScenarioResultsSchema.parse(
        passingScenarios().slice(0, -1),
      ),
    ).toThrow('CURRENT_RELEASE_SCENARIOS_INVALID')
  })

  it('rejects a duplicate scenario', () => {
    const scenarios = passingScenarios()
    scenarios[scenarios.length - 1] = scenarios[0]!

    expect(() =>
      currentReleaseScenarioResultsSchema.parse(scenarios),
    ).toThrow('CURRENT_RELEASE_SCENARIOS_NOT_UNIQUE')
  })

  it('rejects a scenario outside the closed catalog', () => {
    const scenarios: unknown[] = passingScenarios()
    scenarios[scenarios.length - 1] = {
      name: 'billing.stripe',
      status: 'passed',
      durationMs: 10,
    }

    expect(
      currentReleaseScenarioResultsSchema.safeParse(scenarios).success,
    ).toBe(false)
  })

  it('requires bounded duration and a meaningful safe error code', () => {
    const passedWithError = passingScenarios()
    passedWithError[0] = {
      ...passedWithError[0]!,
      errorCode: 'AUTH_FAILED',
    }
    const failedWithoutError = passingScenarios()
    failedWithoutError[0] = {
      ...failedWithoutError[0]!,
      status: 'failed',
    }
    const unsafeError = passingScenarios()
    unsafeError[0] = {
      ...unsafeError[0]!,
      status: 'failed',
      errorCode: 'leaked response',
    }
    const negativeDuration = passingScenarios()
    negativeDuration[0] = {
      ...negativeDuration[0]!,
      durationMs: -1,
    }

    expect(() =>
      currentReleaseScenarioResultsSchema.parse(passedWithError),
    ).toThrow('CURRENT_RELEASE_ERROR_CODE_UNEXPECTED')
    expect(() =>
      currentReleaseScenarioResultsSchema.parse(failedWithoutError),
    ).toThrow('CURRENT_RELEASE_ERROR_CODE_REQUIRED')
    expect(
      currentReleaseScenarioResultsSchema.safeParse(unsafeError).success,
    ).toBe(false)
    expect(
      currentReleaseScenarioResultsSchema.safeParse(negativeDuration)
        .success,
    ).toBe(false)
  })
})

describe('current release cost guard', () => {
  it('stops before a reservation would exceed the operational limit', () => {
    const cost = createAcceptanceCostGuard({
      stopBeforeUsd: 1.5,
      maxUsd: 2,
    })

    cost.reserve('onboarding', 0.4)
    cost.reserve('agents', 0.6)

    expect(cost.totalEstimatedUsd()).toBe(1)
    expect(() => cost.reserve('next-call', 0.6)).toThrow(
      'CURRENT_RELEASE_COST_STOP',
    )
  })

  it.each([0, -0.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid reservation amount: %s',
    (amount) => {
      const cost = createAcceptanceCostGuard({
        stopBeforeUsd: 1.5,
        maxUsd: 2,
      })

      expect(() => cost.reserve('invalid', amount)).toThrow(
        'CURRENT_RELEASE_COST_ESTIMATE_INVALID',
      )
      expect(cost.totalEstimatedUsd()).toBe(0)
    },
  )

  it('rejects duplicate labels without changing the accumulated amount', () => {
    const cost = createAcceptanceCostGuard({
      stopBeforeUsd: 1.5,
      maxUsd: 2,
    })
    cost.reserve('agents', 0.4)

    expect(() => cost.reserve('agents', 0.1)).toThrow(
      'CURRENT_RELEASE_COST_LABEL_DUPLICATE',
    )
    expect(cost.totalEstimatedUsd()).toBe(0.4)
  })

  it('remains stopped after the first stop-limit breach', () => {
    const cost = createAcceptanceCostGuard({
      stopBeforeUsd: 1.5,
      maxUsd: 2,
    })
    cost.reserve('agents', 1.4)

    expect(() => cost.reserve('too-much', 0.2)).toThrow(
      'CURRENT_RELEASE_COST_STOP',
    )
    expect(() => cost.reserve('small-but-late', 0.01)).toThrow(
      'CURRENT_RELEASE_COST_STOP',
    )
    expect(cost.totalEstimatedUsd()).toBe(1.4)
  })

  it('replaces the pipeline reservation with observed cost', () => {
    const cost = createAcceptanceCostGuard({
      stopBeforeUsd: 1.5,
      maxUsd: 2,
    })
    cost.reserve('agents', 0.6)
    cost.reserve('pipeline', 0.25)

    expect(cost.totalEstimatedUsd()).toBe(0.85)

    cost.recordObservedPipelineCost(0.1)

    expect(cost.totalEstimatedUsd()).toBe(0.7)
    expect(cost.observedPipelineCostUsd()).toBe(0.1)
  })

  it('rejects invalid or repeated observed pipeline costs', () => {
    const invalid = createAcceptanceCostGuard({
      stopBeforeUsd: 1.5,
      maxUsd: 2,
    })
    invalid.reserve('pipeline', 0.25)

    expect(() =>
      invalid.recordObservedPipelineCost(Number.NaN),
    ).toThrow('CURRENT_RELEASE_PIPELINE_COST_INVALID')
    expect(() => invalid.recordObservedPipelineCost(-0.01)).toThrow(
      'CURRENT_RELEASE_PIPELINE_COST_INVALID',
    )

    const repeated = createAcceptanceCostGuard({
      stopBeforeUsd: 1.5,
      maxUsd: 2,
    })
    repeated.reserve('pipeline', 0.25)
    repeated.recordObservedPipelineCost(0.1)
    expect(() => repeated.recordObservedPipelineCost(0.1)).toThrow(
      'CURRENT_RELEASE_PIPELINE_COST_ALREADY_RECORDED',
    )
  })

  it('requires a pipeline reservation before recording observed cost', () => {
    const cost = createAcceptanceCostGuard({
      stopBeforeUsd: 1.5,
      maxUsd: 2,
    })

    expect(() => cost.recordObservedPipelineCost(0.1)).toThrow(
      'CURRENT_RELEASE_PIPELINE_RESERVATION_MISSING',
    )
  })

  it('fails closed when observed total exceeds the contractual maximum', () => {
    const cost = createAcceptanceCostGuard({
      stopBeforeUsd: 1.5,
      maxUsd: 2,
    })
    cost.reserve('agents', 0.1)
    cost.reserve('pipeline', 0.25)

    expect(() => cost.recordObservedPipelineCost(2)).toThrow(
      'CURRENT_RELEASE_COST_MAX',
    )
    expect(cost.totalEstimatedUsd()).toBe(2.1)
    expect(() => cost.reserve('after-maximum', 0.01)).toThrow(
      'CURRENT_RELEASE_COST_STOP',
    )
  })

  it('avoids binary floating-point accumulation surprises', () => {
    const cost = createAcceptanceCostGuard({
      stopBeforeUsd: 1.5,
      maxUsd: 2,
    })
    cost.reserve('first', 0.1)
    cost.reserve('second', 0.2)

    expect(cost.totalEstimatedUsd()).toBe(0.3)
  })

  it('rejects cost guard limits outside the accepted contract', () => {
    expect(() =>
      createAcceptanceCostGuard({ stopBeforeUsd: 1.51, maxUsd: 2 }),
    ).toThrow('CURRENT_RELEASE_COST_LIMIT_INVALID')
    expect(() =>
      createAcceptanceCostGuard({ stopBeforeUsd: 1.5, maxUsd: 2.01 }),
    ).toThrow('CURRENT_RELEASE_COST_LIMIT_INVALID')
    expect(() =>
      createAcceptanceCostGuard({ stopBeforeUsd: 0, maxUsd: 2 }),
    ).toThrow('CURRENT_RELEASE_COST_LIMIT_INVALID')
  })
})
