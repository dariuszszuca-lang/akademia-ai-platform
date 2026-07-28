import { describe, expect, it } from 'vitest'
import type { EvidenceLocator } from '../property-sources/domain'
import type { SyntheticCaseCode } from './domain'
import { syntheticCorpus } from './manifest'
import {
  createCostGate,
  normalizeComparableValue,
  scoreSyntheticRun,
  type SyntheticObservation,
} from './scorer'

function observed(
  caseCode: SyntheticCaseCode,
  factKey: string,
  value: SyntheticObservation['value'],
  evidenceLocator: EvidenceLocator | null,
  proposalStatus: SyntheticObservation['proposalStatus'] = 'pending',
  materialId = `${caseCode}-OBS`,
): SyntheticObservation {
  return {
    caseCode,
    materialId,
    factKey,
    value,
    evidenceLocator,
    sourceId: '00000000-0000-4000-8000-000000000001',
    proposalStatus,
  }
}

describe('synthetic acceptance scorer', () => {
  it('matches exact and accepted numeric representations without fuzzy text matching', () => {
    const score = scoreSyntheticRun({
      manifest: syntheticCorpus,
      observations: [
        observed(
          'SYN-M-01',
          'area.usable',
          '83.40 m²',
          { type: 'page', page: 1 },
        ),
        observed(
          'SYN-M-01',
          'price.asking',
          '750 000',
          { type: 'page', page: 1 },
        ),
        observed(
          'SYN-M-01',
          'condition',
          'bardzo dobry stan',
          { type: 'page', page: 1 },
        ),
      ],
      jobs: [],
    })

    expect(score.referenceFactsMatched).toBe(2)
    expect(score.precision).toBeCloseTo(2 / 3)
    expect(score.locatorCoverage).toBe(1)
    expect(score.confirmedProposalCount).toBe(0)
  })

  it.each(['83,40', '83.4', '83.40 m²'])(
    'treats %s as the expected numeric value',
    (value) => {
      const score = scoreSyntheticRun({
        manifest: syntheticCorpus,
        observations: [
          observed(
            'SYN-M-01',
            'area.usable',
            value,
            { type: 'page', page: 1 },
          ),
        ],
        jobs: [],
      })

      expect(score.referenceFactsMatched).toBe(1)
      expect(score.precision).toBe(1)
    },
  )

  it('normalizes JSON key order but not array order', () => {
    expect(
      normalizeComparableValue({ b: 2, a: { d: 4, c: 3 } }),
    ).toBe(
      normalizeComparableValue({ a: { c: 3, d: 4 }, b: 2 }),
    )
    expect(normalizeComparableValue(['woda', 'prąd'])).not.toBe(
      normalizeComparableValue(['prąd', 'woda']),
    )
  })

  it('counts all controlled conflicts and separates false conflicts', () => {
    const controlled = syntheticCorpus.cases.flatMap((item) =>
      item.materials.flatMap((material) =>
        material.facts
          .filter((fact) => fact.conflict)
          .map((fact) =>
            observed(
              item.code,
              fact.factKey,
              fact.value,
              fact.locator,
              'conflict',
              material.id,
            ),
          ),
      ),
    )
    const falseConflict = observed(
      'SYN-M-01',
      'rooms.count',
      4,
      { type: 'page', page: 1 },
      'conflict',
      'SYN-M-01-PDF',
    )

    const score = scoreSyntheticRun({
      manifest: syntheticCorpus,
      observations: [...controlled, falseConflict],
      jobs: [],
    })

    expect(score.conflictsExpected).toBe(5)
    expect(score.conflictsDetected).toBe(5)
    expect(score.falseConflicts).toBe(1)
  })

  it('counts confirmed proposals, duplicate jobs and duplicate proposals', () => {
    const duplicate = observed(
      'SYN-M-01',
      'rooms.count',
      4,
      { type: 'page', page: 1 },
      'accepted',
      'SYN-M-01-PDF',
    )
    const score = scoreSyntheticRun({
      manifest: syntheticCorpus,
      observations: [duplicate, { ...duplicate }],
      jobs: [
        {
          sourceId: duplicate.sourceId,
          idempotencyKey: 'synthetic-job-1',
          durationMs: 120,
          providerCostUsd: 0.01,
          errorCode: null,
        },
        {
          sourceId: duplicate.sourceId,
          idempotencyKey: 'synthetic-job-1',
          durationMs: 130,
          providerCostUsd: 0.02,
          errorCode: 'RETRIED',
        },
      ],
    })

    expect(score.confirmedProposalCount).toBe(2)
    expect(score.duplicateWorkflowCount).toBe(1)
    expect(score.duplicateProposalCount).toBe(1)
    expect(score.durationMs).toBe(250)
    expect(score.providerCostUsd).toBeCloseTo(0.03)
    expect(score.errorsByCode).toEqual({ RETRIED: 1 })
  })
})

describe('synthetic acceptance cost gate', () => {
  it('stops predicted uploads before 2.50 USD and rejects totals above 3 USD', () => {
    const budget = createCostGate({
      stopBeforeUsd: 2.5,
      hardLimitUsd: 3,
    })

    budget.recordJobCost(2.49)

    expect(budget.canStartNextUpload(0.02)).toBe(false)
    expect(() => budget.recordJobCost(0.52)).toThrow(
      'SYNTHETIC_COST_LIMIT_EXCEEDED',
    )
    expect(budget.totalCostUsd).toBe(2.49)
  })
})
