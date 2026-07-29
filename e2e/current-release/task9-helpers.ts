import type {
  BrowserContext,
  Page,
} from '@playwright/test'
import type { CurrentReleaseFixtures } from './fixtures'
import {
  type ChildCostSnapshot,
  createChildCostBudget,
} from './budget'
import type { ResolvedOperatorContext } from './operator'
import type { CurrentReleaseScenario } from '../../src/features/current-release-acceptance/domain'

export type CurrentReleaseBrowserScenario = Exclude<
  CurrentReleaseScenario,
  'cleanup.complete'
>

export type SafeDeletionReceipt = {
  ok: true
  sourceObjects: number
  propertyStudio: 1
  accountKeys: 5
}

export type Task9Runtime = {
  fixtures: CurrentReleaseFixtures
  pageA: Page
  pageB: Page
  contextA: BrowserContext
  contextB: BrowserContext
  budget: ReturnType<typeof createChildCostBudget>
  operatorContext: ResolvedOperatorContext
  runScenario(
    name: CurrentReleaseBrowserScenario,
    errorCode: string,
    action: () => Promise<void>,
  ): Promise<void>
  recordResources(input: {
    organizationId: string
    projectId?: string
    sourceId?: string
    storageKey?: string
  }): Promise<void>
  recordFactId(id: string): Promise<void>
  recordAdminPreviousState(
    agentId: string,
    enabled: boolean,
  ): Promise<void>
  recordDeletionReceipt(
    role: 'a' | 'b',
    receipt: SafeDeletionReceipt,
  ): Promise<void>
}

export type Task9ProposalCandidate = {
  id: string
  factKey: string
  status:
    | 'pending'
    | 'conflict'
    | 'accepted'
    | 'corrected'
    | 'rejected'
    | 'needs_review'
  label: string
  value: unknown
}

export type Task9SelectedProposals = {
  area: Task9ProposalCandidate & {
    factKey: 'area.usable'
    status: 'conflict'
  }
  price: Task9ProposalCandidate & {
    factKey: 'price.asking'
    status: 'pending'
  }
}

export type Task9StudioState = {
  title: string
  organizationId: string
  projectId: string
  factId: string
  sourceId: string
  storageKey: string
  subjectA: string
  subjectB: string
  proposals: {
    area: { id: string; status: 'needs_review' }
    price: { id: string; status: 'rejected' }
  }
}

export function selectTargetProposals(
  proposals: readonly Task9ProposalCandidate[],
): Task9SelectedProposals {
  const areaCandidates = proposals.filter(
    (proposal) => proposal.factKey === 'area.usable',
  )
  const priceCandidates = proposals.filter(
    (proposal) => proposal.factKey === 'price.asking',
  )

  if (
    areaCandidates.length !== 1 ||
    priceCandidates.length !== 1
  ) {
    throw new Error('STUDIO_PROPOSAL_SET_INVALID')
  }

  const area = areaCandidates[0]!
  if (area.status !== 'conflict') {
    throw new Error('STUDIO_AREA_CONFLICT_MISSING')
  }

  const price = priceCandidates[0]!
  if (price.status !== 'pending') {
    throw new Error('STUDIO_PRICE_PENDING_MISSING')
  }

  return {
    area: {
      ...area,
      factKey: 'area.usable',
      status: 'conflict',
    },
    price: {
      ...price,
      factKey: 'price.asking',
      status: 'pending',
    },
  }
}

export type Task9SourceJobCost = {
  sourceId: string
  providerCostMicrounits: number | null
  modelId: string | null
}

export function calculateObservedPipelineUsage(
  jobs: readonly Task9SourceJobCost[],
  currentSourceId: string,
): {
  observedPipelineCostUsd: number
  modelIds: string[]
} {
  let observedMicrounits = 0
  const modelIds = new Set<string>()

  for (const job of jobs) {
    if (job.sourceId !== currentSourceId) continue
    const cost = job.providerCostMicrounits
    if (
      cost !== null &&
      (!Number.isSafeInteger(cost) || cost < 0)
    ) {
      throw new Error('STUDIO_PIPELINE_COST_INVALID')
    }
    observedMicrounits += cost ?? 0
    if (!Number.isSafeInteger(observedMicrounits)) {
      throw new Error('STUDIO_PIPELINE_COST_INVALID')
    }
    const modelId = job.modelId?.trim()
    if (modelId) modelIds.add(modelId)
  }

  return {
    observedPipelineCostUsd: observedMicrounits / 1_000_000,
    modelIds: [...modelIds],
  }
}

type SingleSourceBudget = {
  runBefore<T>(
    kind: 'sourcePipeline',
    callback: () => Promise<T>,
  ): Promise<T>
  snapshot(): ChildCostSnapshot
}

export function createSingleSourcePipeline(
  budget: SingleSourceBudget,
): {
  run<T>(action: () => Promise<T>): Promise<T>
  calls(): number
} {
  let calls = 0

  return {
    async run<T>(action: () => Promise<T>): Promise<T> {
      if (
        calls !== 0 ||
        budget.snapshot().sourcePipelineCalls !== 0
      ) {
        throw new Error('STUDIO_SOURCE_PIPELINE_ALREADY_USED')
      }
      calls = 1
      return budget.runBefore('sourcePipeline', action)
    },
    calls() {
      return calls
    },
  }
}

export type IsolationSummary = {
  statusIs404: boolean
  payloadIsNotFound: boolean
  identifiersAbsent: boolean
}

export function summarizeIsolationResponse(
  status: number,
  rawBody: string,
  forbiddenIdentifiers: readonly string[],
): IsolationSummary {
  let payloadIsNotFound = false
  try {
    const parsed: unknown = JSON.parse(rawBody)
    payloadIsNotFound =
      isRecord(parsed) &&
      hasExactKeys(parsed, ['error']) &&
      parsed.error === 'not_found'
  } catch {
    payloadIsNotFound = false
  }

  return {
    statusIs404: status === 404,
    payloadIsNotFound,
    identifiersAbsent: forbiddenIdentifiers
      .filter((identifier) => identifier.length > 0)
      .every((identifier) => !rawBody.includes(identifier)),
  }
}

export function assertIsolationSummary(
  summary: IsolationSummary,
): void {
  if (
    !summary.statusIs404 ||
    !summary.payloadIsNotFound ||
    !summary.identifiersAbsent
  ) {
    throw new Error('ISOLATION_RESPONSE_INVALID')
  }
}

export type AccountExportSummary = {
  userMatches: boolean
  profilePresent: boolean
  personasPresent: boolean
  currentResourcesPresent: boolean
  accountExportedEventPresent: boolean
  forbiddenBIdentifiersAbsent: boolean
  forbiddenCredentialKeysAbsent: boolean
  observedPipelineCostUsd: number
  modelIds: string[]
}

export function summarizeAccountExport(
  payload: unknown,
  expected: {
    subjectA: string
    currentResourceIds: readonly string[]
    sourceId: string
    forbiddenBIdentifiers: readonly string[]
  },
): AccountExportSummary {
  const root = isRecord(payload) ? payload : {}
  const studio = isRecord(root.propertyStudio)
    ? root.propertyStudio
    : {}
  const sourceJobs = Array.isArray(studio.sourceJobs)
    ? studio.sourceJobs
        .map(readSourceJobCost)
        .filter(
          (job): job is Task9SourceJobCost => job !== null,
        )
    : []
  const usage = calculateObservedPipelineUsage(
    sourceJobs,
    expected.sourceId,
  )

  return {
    userMatches: root.userId === expected.subjectA,
    profilePresent: isNonEmptyData(root.profil),
    personasPresent:
      isNonEmptyData(root.personaBuyer) &&
      isNonEmptyData(root.personaSeller),
    currentResourcesPresent: expected.currentResourceIds.every(
      (identifier) => containsExactScalar(studio, identifier),
    ),
    accountExportedEventPresent: containsExactScalar(
      studio.productEvents,
      'account.exported',
    ),
    forbiddenBIdentifiersAbsent:
      expected.forbiddenBIdentifiers
        .filter((identifier) => identifier.length > 0)
        .every(
          (identifier) =>
            !containsStringFragment(payload, identifier),
        ),
    forbiddenCredentialKeysAbsent: !containsForbiddenCredentialKey(
      payload,
    ),
    ...usage,
  }
}

export function assertAccountExportSummary(
  summary: AccountExportSummary,
): void {
  if (
    !summary.userMatches ||
    !summary.profilePresent ||
    !summary.personasPresent ||
    !summary.currentResourcesPresent ||
    !summary.accountExportedEventPresent ||
    !summary.forbiddenBIdentifiersAbsent ||
    !summary.forbiddenCredentialKeysAbsent
  ) {
    throw new Error('ACCOUNT_EXPORT_INVALID')
  }
}

export function parseSafeDeletionResponse(
  payload: unknown,
): SafeDeletionReceipt {
  if (
    !isRecord(payload) ||
    !hasExactKeys(payload, ['deleted', 'ok']) ||
    payload.ok !== true ||
    !isRecord(payload.deleted) ||
    !hasExactKeys(payload.deleted, [
      'accountKeys',
      'propertyStudio',
      'sourceObjects',
    ]) ||
    !Number.isSafeInteger(payload.deleted.sourceObjects) ||
    (payload.deleted.sourceObjects as number) < 0 ||
    payload.deleted.propertyStudio !== 1 ||
    payload.deleted.accountKeys !== 5
  ) {
    throw new Error('ACCOUNT_DELETION_RECEIPT_INVALID')
  }

  return {
    ok: true,
    sourceObjects: payload.deleted.sourceObjects as number,
    propertyStudio: 1,
    accountKeys: 5,
  }
}

function readSourceJobCost(
  value: unknown,
): Task9SourceJobCost | null {
  if (
    !isRecord(value) ||
    typeof value.sourceId !== 'string'
  ) {
    return null
  }
  const cost = value.providerCostMicrounits
  const modelId = value.modelId
  return {
    sourceId: value.sourceId,
    providerCostMicrounits:
      cost === null || typeof cost === 'number' ? cost : Number.NaN,
    modelId:
      modelId === null || typeof modelId === 'string'
        ? modelId
        : null,
  }
}

const forbiddenCredentialKeys = new Set([
  'signedurl',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'authorization',
  'password',
])

function containsForbiddenCredentialKey(
  value: unknown,
  seen = new WeakSet<object>(),
): boolean {
  if (!value || typeof value !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)

  if (Array.isArray(value)) {
    return value.some((item) =>
      containsForbiddenCredentialKey(item, seen),
    )
  }

  return Object.entries(value).some(([key, child]) => {
    const normalizedKey = key
      .toLocaleLowerCase('en-US')
      .replace(/[^a-z]/g, '')
    return (
      forbiddenCredentialKeys.has(normalizedKey) ||
      containsForbiddenCredentialKey(child, seen)
    )
  })
}

function containsExactScalar(
  value: unknown,
  expected: string,
  seen = new WeakSet<object>(),
): boolean {
  if (value === expected) return true
  if (!value || typeof value !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)
  return Array.isArray(value)
    ? value.some((item) =>
        containsExactScalar(item, expected, seen),
      )
    : Object.values(value).some((item) =>
        containsExactScalar(item, expected, seen),
      )
}

function containsStringFragment(
  value: unknown,
  fragment: string,
  seen = new WeakSet<object>(),
): boolean {
  if (typeof value === 'string') return value.includes(fragment)
  if (!value || typeof value !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)
  return Array.isArray(value)
    ? value.some((item) =>
        containsStringFragment(item, fragment, seen),
      )
    : Object.values(value).some((item) =>
        containsStringFragment(item, fragment, seen),
      )
}

function isNonEmptyData(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return isRecord(value) && Object.keys(value).length > 0
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value).sort()
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === [...expected].sort()[index])
  )
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}
