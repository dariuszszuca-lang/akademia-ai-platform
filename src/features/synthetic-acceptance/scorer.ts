import { z } from 'zod'
import type {
  EvidenceLocator,
  FactProposalStatus,
} from '../property-sources/domain'
import type {
  ExpectedSyntheticFact,
  SyntheticCaseCode,
  SyntheticCorpus,
} from './domain'
import { syntheticCorpusSchema } from './domain'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type SyntheticObservation = {
  caseCode: SyntheticCaseCode
  materialId: string
  factKey: string
  value: JsonValue
  evidenceLocator: EvidenceLocator | null
  sourceId: string
  proposalStatus: FactProposalStatus
}

export type SyntheticJobObservation = {
  sourceId: string
  idempotencyKey: string
  durationMs: number
  providerCostUsd: number
  errorCode: string | null
}

export type SyntheticAcceptanceScore = {
  referenceFactsTotal: number
  referenceFactsMatched: number
  precision: number
  locatorCoverage: number
  conflictsExpected: number
  conflictsDetected: number
  falseConflicts: number
  confirmedProposalCount: number
  duplicateWorkflowCount: number
  duplicateProposalCount: number
  durationMs: number
  providerCostUsd: number
  errorsByCode: Record<string, number>
  accepted: boolean
}

export const syntheticAcceptanceScoreSchema = z
  .object({
    referenceFactsTotal: z.number().int().nonnegative(),
    referenceFactsMatched: z.number().int().nonnegative(),
    precision: z.number().min(0).max(1),
    locatorCoverage: z.number().min(0).max(1),
    conflictsExpected: z.number().int().nonnegative(),
    conflictsDetected: z.number().int().nonnegative(),
    falseConflicts: z.number().int().nonnegative(),
    confirmedProposalCount: z.number().int().nonnegative(),
    duplicateWorkflowCount: z.number().int().nonnegative(),
    duplicateProposalCount: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    providerCostUsd: z.number().nonnegative(),
    errorsByCode: z.record(
      z.string(),
      z.number().int().nonnegative(),
    ),
    accepted: z.boolean(),
  })
  .strict()

type ReferenceFact = {
  caseCode: SyntheticCaseCode
  materialId: string
  fact: ExpectedSyntheticFact
}

export function scoreSyntheticRun({
  manifest,
  observations,
  jobs,
}: {
  manifest: SyntheticCorpus
  observations: SyntheticObservation[]
  jobs: SyntheticJobObservation[]
}): SyntheticAcceptanceScore {
  const parsed = syntheticCorpusSchema.parse(manifest)
  const references: ReferenceFact[] = parsed.cases.flatMap((item) =>
    item.materials.flatMap((material) =>
      material.facts.map((fact) => ({
        caseCode: item.code,
        materialId: material.id,
        fact,
      })),
    ),
  )
  const matchedReferences = new Set<number>()
  const detectedConflicts = new Set<number>()
  let matchedObservations = 0
  let falseConflicts = 0

  for (const observation of observations) {
    const candidates = references
      .map((reference, index) => ({ reference, index }))
      .filter(
        ({ reference }) =>
          reference.caseCode === observation.caseCode &&
          reference.fact.factKey === observation.factKey,
      )
      .sort(
        ({ reference: left }, { reference: right }) =>
          Number(right.materialId === observation.materialId) -
          Number(left.materialId === observation.materialId),
      )
    const valueMatch = candidates.find(({ reference }) =>
      valuesMatch(reference.fact, observation.value),
    )

    if (valueMatch) {
      matchedObservations += 1
      matchedReferences.add(valueMatch.index)
    }

    if (observation.proposalStatus === 'conflict') {
      const expectedConflict = candidates.find(
        ({ reference }) => reference.fact.conflict,
      )
      if (expectedConflict) {
        detectedConflicts.add(expectedConflict.index)
      } else {
        falseConflicts += 1
      }
    }
  }

  const score: SyntheticAcceptanceScore = {
    referenceFactsTotal: references.length,
    referenceFactsMatched: matchedReferences.size,
    precision:
      observations.length === 0
        ? 0
        : matchedObservations / observations.length,
    locatorCoverage:
      observations.length === 0
        ? 0
        : observations.filter(
            (observation) => observation.evidenceLocator !== null,
          ).length / observations.length,
    conflictsExpected: references.filter(
      (reference) => reference.fact.conflict,
    ).length,
    conflictsDetected: detectedConflicts.size,
    falseConflicts,
    confirmedProposalCount: observations.filter((observation) =>
      ['accepted', 'corrected'].includes(observation.proposalStatus),
    ).length,
    duplicateWorkflowCount: countDuplicates(
      jobs.map((job) => `${job.sourceId}\u0000${job.idempotencyKey}`),
    ),
    duplicateProposalCount: countDuplicates(
      observations.map((observation) =>
        [
          observation.caseCode,
          observation.materialId,
          observation.sourceId,
          observation.factKey,
          normalizeComparableValue(observation.value),
        ].join('\u0000'),
      ),
    ),
    durationMs: jobs.reduce((total, job) => total + job.durationMs, 0),
    providerCostUsd: jobs.reduce(
      (total, job) => total + job.providerCostUsd,
      0,
    ),
    errorsByCode: countErrorCodes(jobs),
    accepted: false,
  }
  score.accepted = isAccepted(score)
  return syntheticAcceptanceScoreSchema.parse(score)
}

export function isAccepted(score: SyntheticAcceptanceScore): boolean {
  return (
    score.precision >= 0.9 &&
    score.locatorCoverage === 1 &&
    score.confirmedProposalCount === 0 &&
    score.conflictsDetected === 5 &&
    score.falseConflicts === 0 &&
    score.duplicateWorkflowCount === 0 &&
    score.duplicateProposalCount === 0 &&
    score.providerCostUsd <= 3
  )
}

export function normalizeComparableValue(
  value: JsonValue,
  expectedUnit?: string,
): string {
  if (typeof value === 'number') {
    return `number:${normalizeNumber(value)}`
  }
  if (typeof value === 'string') {
    const numeric = parseComparableNumber(value, expectedUnit)
    return numeric === null
      ? `string:${value.trim().normalize('NFC')}`
      : `number:${normalizeNumber(numeric)}`
  }
  return `json:${stableJson(value)}`
}

export function createCostGate({
  stopBeforeUsd,
  hardLimitUsd,
}: {
  stopBeforeUsd: number
  hardLimitUsd: number
}) {
  if (
    !Number.isFinite(stopBeforeUsd) ||
    !Number.isFinite(hardLimitUsd) ||
    stopBeforeUsd <= 0 ||
    hardLimitUsd > 3 ||
    stopBeforeUsd >= hardLimitUsd
  ) {
    throw new Error('SYNTHETIC_COST_GATE_INVALID')
  }

  let totalCostUsd = 0
  return {
    get totalCostUsd() {
      return totalCostUsd
    },
    canStartNextUpload(estimatedCostUsd: number) {
      assertNonnegativeCost(estimatedCostUsd)
      return totalCostUsd + estimatedCostUsd < stopBeforeUsd
    },
    recordJobCost(costUsd: number) {
      assertNonnegativeCost(costUsd)
      const nextTotal = totalCostUsd + costUsd
      if (nextTotal > hardLimitUsd) {
        throw new Error('SYNTHETIC_COST_LIMIT_EXCEEDED')
      }
      totalCostUsd = nextTotal
      return totalCostUsd
    },
  }
}

function valuesMatch(
  expected: ExpectedSyntheticFact,
  observed: JsonValue,
): boolean {
  const observedValue = normalizeComparableValue(observed, expected.unit)
  return [expected.value, ...expected.acceptedVariants].some(
    (candidate) =>
      normalizeComparableValue(candidate, expected.unit) ===
      observedValue,
  )
}

function parseComparableNumber(
  rawValue: string,
  expectedUnit?: string,
): number | null {
  let value = rawValue.trim().normalize('NFC')
  if (expectedUnit && value.endsWith(expectedUnit)) {
    value = value.slice(0, -expectedUnit.length).trim()
  } else if (/[^\d\s.,+-]/u.test(value)) {
    return null
  }

  const compact = value.replace(/[\s\u00a0](?=\d)/g, '')
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(compact)) return null
  const number = Number(compact.replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

function normalizeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error('SYNTHETIC_NON_FINITE_NUMBER')
  }
  return Object.is(value, -0) ? '0' : String(value)
}

function stableJson(value: Exclude<JsonValue, string | number>): string {
  if (value === null || typeof value === 'boolean') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonValue(item)).join(',')}]`
  }
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableJsonValue(value[key])}`,
    )
    .join(',')}}`
}

function stableJsonValue(value: JsonValue): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') return normalizeNumber(value)
  return stableJson(value)
}

function countDuplicates(keys: string[]): number {
  return keys.length - new Set(keys).size
}

function countErrorCodes(
  jobs: SyntheticJobObservation[],
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const job of jobs) {
    if (!job.errorCode) continue
    result[job.errorCode] = (result[job.errorCode] ?? 0) + 1
  }
  return result
}

function assertNonnegativeCost(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('SYNTHETIC_COST_INVALID')
  }
}
