import { createHash } from 'node:crypto'
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
  sourceId: string
  jobId: string
  valueType: string
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
  jobId: string
  storageKey: string
  subjectA: string
  subjectB: string
  proposals: {
    area: { id: string; status: 'accepted' }
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
  if (
    area.valueType !== 'number' ||
    typeof area.value !== 'number' ||
    !Number.isFinite(area.value) ||
    area.value !== 83.4
  ) {
    throw new Error('STUDIO_AREA_VALUE_INVALID')
  }

  const price = priceCandidates[0]!
  if (price.status !== 'pending') {
    throw new Error('STUDIO_PRICE_PENDING_MISSING')
  }
  if (
    price.valueType !== 'number' ||
    typeof price.value !== 'number' ||
    !Number.isSafeInteger(price.value) ||
    price.value !== 750_000
  ) {
    throw new Error('STUDIO_PRICE_VALUE_INVALID')
  }
  if (
    area.sourceId.length === 0 ||
    area.jobId.length === 0 ||
    area.sourceId !== price.sourceId ||
    area.jobId !== price.jobId
  ) {
    throw new Error('STUDIO_PROPOSAL_SCOPE_INVALID')
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

export type Task9ProposalDecisionReadback = {
  accepted: {
    id: string
    factKey: 'area.usable'
    status: 'accepted'
  }
  rejected: {
    id: string
    factKey: 'price.asking'
    status: 'rejected'
  }
}

export function parseProposalDecisionReadback(
  payload: unknown,
  expected: {
    acceptedId: string
    rejectedId: string
    sourceId: string
    jobId: string
  },
): Task9ProposalDecisionReadback {
  if (
    expected.acceptedId === expected.rejectedId ||
    !isRecord(payload) ||
    !Array.isArray(payload.proposals)
  ) {
    throw new Error('STUDIO_PROPOSAL_READBACK_INVALID')
  }

  const scopedProposals = payload.proposals.filter(
    (proposal) =>
      isRecord(proposal) &&
      proposal.sourceId === expected.sourceId &&
      proposal.jobId === expected.jobId,
  )
  const terminalProposals = scopedProposals.filter(
    (proposal) =>
      ['accepted', 'corrected', 'rejected'].includes(
        String(proposal.status),
      ),
  )
  const accepted = terminalProposals.filter(
    (proposal) => proposal.status === 'accepted',
  )
  const rejected = terminalProposals.filter(
    (proposal) => proposal.status === 'rejected',
  )
  if (
    terminalProposals.length !== 2 ||
    accepted.length !== 1 ||
    accepted[0]!.id !== expected.acceptedId ||
    accepted[0]!.factKey !== 'area.usable' ||
    accepted[0]!.valueType !== 'number' ||
    accepted[0]!.value !== 83.4 ||
    rejected.length !== 1 ||
    rejected[0]!.id !== expected.rejectedId ||
    rejected[0]!.factKey !== 'price.asking' ||
    rejected[0]!.valueType !== 'number' ||
    rejected[0]!.value !== 750_000
  ) {
    throw new Error('STUDIO_PROPOSAL_READBACK_INVALID')
  }

  return {
    accepted: {
      id: expected.acceptedId,
      factKey: 'area.usable',
      status: 'accepted',
    },
    rejected: {
      id: expected.rejectedId,
      factKey: 'price.asking',
      status: 'rejected',
    },
  }
}

type AcceptedAreaExpectation = {
  factId: string
  projectId: string
  subjectA: string
  sourceId: string
}

export function parseAcceptedAreaDecisionResponse(
  payload: unknown,
  expected: AcceptedAreaExpectation & {
    proposalId: string
    jobId: string
    preAcceptVersion: number
  },
): {
  proposalId: string
  factId: string
  version: number
  value: 83.4
} {
  if (
    !isRecord(payload) ||
    payload.decisionCreated !== true ||
    !isRecord(payload.proposal) ||
    payload.proposal.id !== expected.proposalId ||
    payload.proposal.factKey !== 'area.usable' ||
    payload.proposal.status !== 'accepted' ||
    payload.proposal.sourceId !== expected.sourceId ||
    payload.proposal.jobId !== expected.jobId ||
    payload.proposal.valueType !== 'number' ||
    payload.proposal.value !== 83.4 ||
    !isAcceptedAreaFact(payload.fact, {
      ...expected,
      version: (isRecord(payload.fact)
        ? payload.fact.version
        : null) as unknown,
    }) ||
    !isRecord(payload.fact) ||
    !Number.isSafeInteger(payload.fact.version) ||
    (payload.fact.version as number) <= expected.preAcceptVersion
  ) {
    throw new Error('STUDIO_ACCEPTED_AREA_INVALID')
  }

  return {
    proposalId: expected.proposalId,
    factId: expected.factId,
    version: payload.fact.version as number,
    value: 83.4,
  }
}

export function parseRejectedPriceDecisionResponse(
  payload: unknown,
  expected: {
    proposalId: string
    sourceId: string
    jobId: string
  },
): {
  proposalId: string
  factIsNull: true
} {
  if (
    !isRecord(payload) ||
    payload.decisionCreated !== true ||
    payload.fact !== null ||
    !isRecord(payload.proposal) ||
    payload.proposal.id !== expected.proposalId ||
    payload.proposal.factKey !== 'price.asking' ||
    payload.proposal.status !== 'rejected' ||
    payload.proposal.sourceId !== expected.sourceId ||
    payload.proposal.jobId !== expected.jobId ||
    payload.proposal.valueType !== 'number' ||
    payload.proposal.value !== 750_000
  ) {
    throw new Error('STUDIO_REJECTED_PRICE_INVALID')
  }

  return {
    proposalId: expected.proposalId,
    factIsNull: true,
  }
}

export function parseAcceptedAreaFactList(
  payload: unknown,
  expected: AcceptedAreaExpectation & {
    version: number
  },
): {
  factId: string
  version: number
  value: 83.4
  factCount: 1
} {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.facts) ||
    payload.facts.length !== 1 ||
    !isAcceptedAreaFact(payload.facts[0], expected)
  ) {
    throw new Error('STUDIO_ACCEPTED_AREA_READBACK_INVALID')
  }

  return {
    factId: expected.factId,
    version: expected.version,
    value: 83.4,
    factCount: 1,
  }
}

function isAcceptedAreaFact(
  value: unknown,
  expected: AcceptedAreaExpectation & {
    version: unknown
  },
): boolean {
  return (
    isRecord(value) &&
    value.id === expected.factId &&
    value.propertyProjectId === expected.projectId &&
    value.key === 'area.usable' &&
    value.valueType === 'number' &&
    value.value === 83.4 &&
    value.unit === 'm²' &&
    value.status === 'confirmed' &&
    value.visibility === 'internal' &&
    value.confirmedByUserId === expected.subjectA &&
    Array.isArray(value.sourceIds) &&
    value.sourceIds.includes(expected.sourceId) &&
    Number.isSafeInteger(value.version) &&
    value.version === expected.version
  )
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

export function parseCurrentSourceJobEvidence(
  jobs: readonly unknown[],
  expected: {
    organizationId: string
    projectId: string
    sourceId: string
    jobId: string
    maxUsd: number
    reservedUsd: number
    sourceReservationUsd: number
  },
): {
  observedPipelineCostUsd: number
  modelIds: string[]
} {
  const safeModelIdPattern =
    /^(?:claude-[a-z0-9]+(?:-[a-z0-9]+)*|eu\.anthropic\.claude-[a-z0-9]+(?:-[a-z0-9]+)*(?::[0-9]+)?)$/
  const matching = jobs.filter(
    (job) =>
      isRecord(job) &&
      job.id === expected.jobId &&
      job.sourceId === expected.sourceId,
  )
  const job = matching[0]
  if (
    jobs.length !== 1 ||
    matching.length !== 1 ||
    !isRecord(job) ||
    job.organizationId !== expected.organizationId ||
    job.propertyProjectId !== expected.projectId ||
    job.status !== 'succeeded' ||
    !Number.isSafeInteger(job.providerCostMicrounits) ||
    (job.providerCostMicrounits as number) <= 0 ||
    job.currency !== 'USD' ||
    typeof job.modelId !== 'string' ||
    job.modelId.trim().length === 0 ||
    job.modelId.trim().length > 200 ||
    !safeModelIdPattern.test(job.modelId.trim()) ||
    !Number.isFinite(expected.maxUsd) ||
    expected.maxUsd <= 0 ||
    !Number.isFinite(expected.reservedUsd) ||
    expected.reservedUsd < expected.sourceReservationUsd ||
    !Number.isFinite(expected.sourceReservationUsd) ||
    expected.sourceReservationUsd <= 0
  ) {
    throw new Error('STUDIO_PIPELINE_JOB_INVALID')
  }
  const observedPipelineCostUsd =
    (job.providerCostMicrounits as number) / 1_000_000
  if (observedPipelineCostUsd > expected.maxUsd) {
    throw new Error('STUDIO_PIPELINE_JOB_INVALID')
  }
  const sharedObservedTotalUsd =
    expected.reservedUsd -
    expected.sourceReservationUsd +
    observedPipelineCostUsd
  if (
    sharedObservedTotalUsd < 0 ||
    sharedObservedTotalUsd > expected.maxUsd
  ) {
    throw new Error('STUDIO_PIPELINE_JOB_INVALID')
  }

  return {
    observedPipelineCostUsd,
    modelIds: [job.modelId.trim()],
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

export type UiIsolationSummary = {
  accessBlocked: boolean
  workspaceAbsent: boolean
  identifiersAbsent: boolean
}

export function summarizeUiIsolationResponse(input: {
  status: number | null
  visibleText: string
  workspaceVisible: boolean
  forbiddenIdentifiers: readonly string[]
}): UiIsolationSummary {
  return {
    accessBlocked:
      input.status === 404 ||
      /(?:\b404\b|not found|nie znalezion)/i.test(
        input.visibleText,
      ),
    workspaceAbsent: !input.workspaceVisible,
    identifiersAbsent: input.forbiddenIdentifiers
      .filter((identifier) => identifier.length > 0)
      .every(
        (identifier) => !input.visibleText.includes(identifier),
      ),
  }
}

export function assertUiIsolationSummary(
  summary: UiIsolationSummary,
): void {
  if (
    !summary.accessBlocked ||
    !summary.workspaceAbsent ||
    !summary.identifiersAbsent
  ) {
    throw new Error('ISOLATION_UI_ACCESSIBLE')
  }
}

export type FactUpdateSummary = {
  factId: string
  value: number
  version: number
  status: 'confirmed'
  visibility: 'internal'
}

export function parseFactUpdateResponse(
  payload: unknown,
  expected: {
    factId: string
    projectId: string
    subjectA: string
    value: number
    version: number
  },
): FactUpdateSummary {
  const fact =
    isRecord(payload) && isRecord(payload.fact)
      ? payload.fact
      : null
  if (
    fact === null ||
    fact.id !== expected.factId ||
    fact.propertyProjectId !== expected.projectId ||
    fact.key !== 'area.usable' ||
    fact.label !== 'Powierzchnia użytkowa' ||
    fact.valueType !== 'number' ||
    fact.value !== expected.value ||
    fact.unit !== 'm²' ||
    fact.status !== 'confirmed' ||
    fact.visibility !== 'internal' ||
    fact.confirmedByUserId !== expected.subjectA ||
    fact.confirmedByUserId === 'current-session-user' ||
    !Number.isSafeInteger(fact.version) ||
    fact.version !== expected.version ||
    expected.version < 1
  ) {
    throw new Error('STUDIO_FACT_UPDATE_INVALID')
  }

  return {
    factId: expected.factId,
    value: expected.value,
    version: expected.version,
    status: 'confirmed',
    visibility: 'internal',
  }
}

export type PersistedFactSummary = {
  factId: string
  key: 'area.usable'
  value: number
  version: number
  status: 'confirmed'
  visibility: 'internal'
}

export function parsePersistedFactList(
  payload: unknown,
  expected: {
    factId: string
    projectId: string
    subjectA: string
    value: number
    version: number
  },
): PersistedFactSummary {
  if (!isRecord(payload) || !Array.isArray(payload.facts)) {
    throw new Error('STUDIO_FACT_READBACK_INVALID')
  }
  const facts = payload.facts.filter(
    (fact) => isRecord(fact) && fact.id === expected.factId,
  )
  if (facts.length !== 1) {
    throw new Error('STUDIO_FACT_READBACK_INVALID')
  }
  const fact = facts[0]!
  if (
    fact.propertyProjectId !== expected.projectId ||
    fact.key !== 'area.usable' ||
    fact.label !== 'Powierzchnia użytkowa' ||
    fact.valueType !== 'number' ||
    fact.value !== expected.value ||
    fact.unit !== 'm²' ||
    fact.status !== 'confirmed' ||
    fact.visibility !== 'internal' ||
    fact.confirmedByUserId !== expected.subjectA ||
    fact.confirmedByUserId === 'current-session-user' ||
    !Number.isSafeInteger(fact.version) ||
    fact.version !== expected.version ||
    expected.version < 1
  ) {
    throw new Error('STUDIO_FACT_READBACK_INVALID')
  }

  return {
    factId: expected.factId,
    key: 'area.usable',
    value: expected.value,
    version: expected.version,
    status: 'confirmed',
    visibility: 'internal',
  }
}

export type DownloadedPdfSummary = {
  statusIs200: boolean
  contentTypeIsPdf: boolean
  bodyLooksLikePdf: boolean
  bodySizeBytes: number
  sha256Matches: boolean
}

export function parseSignedS3DownloadUrl(
  rawUrl: string,
  expected: {
    bucketName: string
    region: string
    storageKey: string
  },
): {
  expiresSeconds: number
} {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('STUDIO_SOURCE_DOWNLOAD_URL_INVALID')
  }
  const expectedHost =
    `${expected.bucketName}.s3.${expected.region}.amazonaws.com`
      .toLocaleLowerCase('en-US')
  const rawAuthority =
    rawUrl.match(/^https:\/\/([^/?#]+)/i)?.[1] ?? ''
  const expiresValues = url.searchParams.getAll('X-Amz-Expires')
  const expiresRaw = expiresValues[0] ?? ''
  const expiresSeconds = Number(expiresRaw)
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== '' ||
    rawAuthority.toLocaleLowerCase('en-US') !== expectedHost ||
    url.hostname.toLocaleLowerCase('en-US') !== expectedHost ||
    url.pathname !== `/${expected.storageKey}` ||
    url.hash !== '' ||
    expiresValues.length !== 1 ||
    !/^\d+$/.test(expiresRaw) ||
    !Number.isSafeInteger(expiresSeconds) ||
    expiresSeconds < 1 ||
    expiresSeconds > 65 ||
    url.searchParams.get('X-Amz-Algorithm') !==
      'AWS4-HMAC-SHA256' ||
    !url.searchParams.get('X-Amz-Signature')
  ) {
    throw new Error('STUDIO_SOURCE_DOWNLOAD_URL_INVALID')
  }

  return { expiresSeconds }
}

export function parsePdfDownloadHeaders(
  status: number,
  headers: Record<string, string>,
): {
  contentLength: number
  contentType: 'application/pdf'
} {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key.toLocaleLowerCase('en-US'),
      value,
    ]),
  )
  const contentType = normalized['content-type']
    ?.split(';', 1)[0]
    ?.trim()
    .toLocaleLowerCase('en-US')
  const lengthRaw = normalized['content-length']?.trim() ?? ''
  const contentLength = Number(lengthRaw)
  if (
    status !== 200 ||
    contentType !== 'application/pdf' ||
    !/^\d+$/.test(lengthRaw) ||
    !Number.isSafeInteger(contentLength) ||
    contentLength < 100 ||
    contentLength > 25 * 1024 * 1024
  ) {
    throw new Error('STUDIO_SOURCE_DOWNLOAD_HEADERS_INVALID')
  }

  return {
    contentLength,
    contentType: 'application/pdf',
  }
}

export function summarizeDownloadedPdf(input: {
  status: number
  contentType: string
  body: Uint8Array
  expectedSha256: string
}): DownloadedPdfSummary {
  const bodySizeBytes = input.body.byteLength
  const hasPdfHeader =
    input.body.length >= 5 &&
    input.body[0] === 0x25 &&
    input.body[1] === 0x50 &&
    input.body[2] === 0x44 &&
    input.body[3] === 0x46 &&
    input.body[4] === 0x2d

  return {
    statusIs200: input.status === 200,
    contentTypeIsPdf:
      input.contentType
        .split(';', 1)[0]
        ?.trim()
        .toLocaleLowerCase('en-US') === 'application/pdf',
    bodyLooksLikePdf:
      hasPdfHeader &&
      bodySizeBytes >= 100 &&
      bodySizeBytes <= 25 * 1024 * 1024,
    bodySizeBytes,
    sha256Matches:
      /^[a-f0-9]{64}$/.test(input.expectedSha256) &&
      createHash('sha256').update(input.body).digest('hex') ===
        input.expectedSha256,
  }
}

export function assertDownloadedPdfSummary(
  summary: DownloadedPdfSummary,
): void {
  if (
    !summary.statusIs200 ||
    !summary.contentTypeIsPdf ||
    !summary.bodyLooksLikePdf ||
    !summary.sha256Matches
  ) {
    throw new Error('STUDIO_SOURCE_DOWNLOAD_INVALID')
  }
}

export function assertRejectedAdminLogin(
  status: number,
  payload: unknown,
): void {
  if (
    status !== 401 ||
    !isRecord(payload) ||
    !hasExactKeys(payload, ['error']) ||
    payload.error !== 'Invalid password'
  ) {
    throw new Error('ADMIN_INVALID_PASSWORD_NOT_REJECTED')
  }
}

export function summarizePilotAccessEvidence(input: {
  heading: string
  status: string
  description: string
}): boolean {
  return (
    input.heading.trim() === 'Dostęp pilotażowy Pro' &&
    input.status.trim() === 'Aktywny' &&
    /W pilotażu masz aktywne wszystkie funkcje planu Pro\./.test(
      input.description,
    ) &&
    /Płatności są obecnie wyłączone\./.test(
      input.description,
    )
  )
}

export async function assertMobileFocusBorderEvidence(input: {
  blur(): Promise<void>
  focus(): Promise<void>
  isFocused(): Promise<boolean>
  readBorderColor(): Promise<string>
}): Promise<void> {
  await input.blur()
  if (await input.isFocused()) {
    throw new Error('UI_MOBILE_ADMIN_FOCUS_INVALID')
  }
  const unfocusedBorder = await input.readBorderColor()

  await input.focus()
  if (!(await input.isFocused())) {
    throw new Error('UI_MOBILE_ADMIN_FOCUS_INVALID')
  }
  const focusedBorder = await input.readBorderColor()

  if (
    unfocusedBorder.trim().length === 0 ||
    focusedBorder.trim().length === 0 ||
    focusedBorder === unfocusedBorder
  ) {
    throw new Error('UI_MOBILE_ADMIN_FOCUS_INVALID')
  }
}

export async function runAdminFinallyProtocol(input: {
  hadSuccessfulLogin: boolean
  primaryError: unknown | null
  ensureSuccessfulLogin(): Promise<void>
  restore(): Promise<void>
  logout(): Promise<void>
}): Promise<void> {
  let cleanupError: unknown | null = null
  const attempt = async (
    action: () => Promise<void>,
  ): Promise<void> => {
    try {
      await action()
    } catch (error) {
      cleanupError ??= error
    }
  }

  if (!input.hadSuccessfulLogin) {
    await attempt(input.ensureSuccessfulLogin)
  }
  await attempt(input.restore)
  await attempt(input.logout)

  if (input.primaryError !== null) throw input.primaryError
  if (cleanupError !== null) throw cleanupError
}

export function parseAdminAgentState(
  payload: unknown,
  agentId: string,
): {
  enabled: boolean
  kvConfigured: true
} {
  if (
    !isRecord(payload) ||
    !hasExactKeys(payload, ['agents', 'kv']) ||
    !Array.isArray(payload.agents) ||
    !isRecord(payload.kv) ||
    !hasExactKeys(payload.kv, ['configured']) ||
    typeof payload.kv.configured !== 'boolean'
  ) {
    throw new Error('ADMIN_AGENT_STATE_INVALID')
  }
  if (!payload.kv.configured) {
    throw new Error('ADMIN_KV_UNAVAILABLE')
  }

  const matchingAgents = payload.agents.filter(
    (agent) => isRecord(agent) && agent.id === agentId,
  )
  if (
    matchingAgents.length !== 1 ||
    typeof matchingAgents[0]!.enabled !== 'boolean'
  ) {
    throw new Error('ADMIN_AGENT_STATE_INVALID')
  }

  return {
    enabled: matchingAgents[0]!.enabled as boolean,
    kvConfigured: true,
  }
}

export type AccountExportSummary = {
  userMatches: boolean
  profilePresent: boolean
  personasPresent: boolean
  onboardingPresent: boolean
  subscriptionStatePresent: boolean
  pilotAccessModeConfirmed: boolean
  currentResourcesPresent: boolean
  currentSourceJobPresent: boolean
  auditEvidencePresent: boolean
  studioEventsPresent: boolean
  accountExportedEventPresent: boolean
  forbiddenBIdentifiersAbsent: boolean
  forbiddenCredentialKeysAbsent: boolean
  forbiddenCredentialValuesAbsent: boolean
  observedPipelineCostUsd: number
  modelIds: string[]
}

type AccountExportExpected = {
  subjectA: string
  organizationId: string
  projectId: string
  factId: string
  sourceId: string
  sourceJobId: string
  acceptedProposalId: string
  rejectedProposalId: string
  maxUsd: number
  reservedUsd: number
  sourceReservationUsd: number
  forbiddenBIdentifiers: readonly string[]
  pilotAccessModeConfirmed: boolean
}

export function summarizeAccountExport(
  payload: unknown,
  expected: AccountExportExpected,
): AccountExportSummary {
  const root = isRecord(payload) ? payload : {}
  const studio = isRecord(root.propertyStudio)
    ? root.propertyStudio
    : {}
  let currentJobEvidence: {
    observedPipelineCostUsd: number
    modelIds: string[]
  } | null = null
  try {
    currentJobEvidence = parseCurrentSourceJobEvidence(
      Array.isArray(studio.sourceJobs)
        ? studio.sourceJobs
        : [],
      {
        organizationId: expected.organizationId,
        projectId: expected.projectId,
        sourceId: expected.sourceId,
        jobId: expected.sourceJobId,
        maxUsd: expected.maxUsd,
        reservedUsd: expected.reservedUsd,
        sourceReservationUsd: expected.sourceReservationUsd,
      },
    )
  } catch {
    currentJobEvidence = null
  }
  const usage = currentJobEvidence ?? {
    observedPipelineCostUsd: 0,
    modelIds: [],
  }
  const projects = readCollection(studio, 'projects')
  const facts = readCollection(studio, 'facts')
  const sources = readCollection(studio, 'sources')
  const proposals = readCollection(studio, 'factProposals')
  const jobs = readCollection(studio, 'sourceJobs')
  const audit = readCollection(studio, 'audit')
  const productEvents = readCollection(studio, 'productEvents')
  const currentResourcesPresent =
    hasExactProject(projects, expected) &&
    hasExactFact(facts, expected) &&
    hasExactSource(sources, expected) &&
    hasExactProposalCollection(proposals, expected)
  const currentSourceJobPresent =
    jobs !== null && currentJobEvidence !== null
  const auditEvidencePresent = hasExpectedAuditEvidence(
    audit,
    expected,
  )
  const studioEventsPresent = hasExpectedStudioEvents(
    productEvents,
    expected,
  )
  const accountExportedEventPresent =
    hasAccountExportedEvent(productEvents)

  return {
    userMatches: root.userId === expected.subjectA,
    profilePresent: isNonEmptyData(root.profil),
    personasPresent:
      isNonEmptyData(root.personaBuyer) &&
      isNonEmptyData(root.personaSeller),
    onboardingPresent: hasOnboardingState(root.onboarding),
    subscriptionStatePresent: hasSubscriptionState(
      root.subscription,
    ),
    pilotAccessModeConfirmed:
      expected.pilotAccessModeConfirmed === true,
    currentResourcesPresent,
    currentSourceJobPresent,
    auditEvidencePresent,
    studioEventsPresent,
    accountExportedEventPresent,
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
    forbiddenCredentialValuesAbsent:
      !containsForbiddenCredentialValue(payload),
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
    !summary.onboardingPresent ||
    !summary.subscriptionStatePresent ||
    !summary.pilotAccessModeConfirmed ||
    !summary.currentResourcesPresent ||
    !summary.currentSourceJobPresent ||
    !summary.auditEvidencePresent ||
    !summary.studioEventsPresent ||
    !summary.accountExportedEventPresent ||
    !summary.forbiddenBIdentifiersAbsent ||
    !summary.forbiddenCredentialKeysAbsent ||
    !summary.forbiddenCredentialValuesAbsent
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

function readCollection(
  studio: Record<string, unknown>,
  key: string,
): unknown[] | null {
  return Array.isArray(studio[key]) ? studio[key] : null
}

function hasExactProject(
  projects: unknown[] | null,
  expected: AccountExportExpected,
): boolean {
  return (
    projects?.length === 1 &&
    isRecord(projects[0]) &&
    projects[0].id === expected.projectId &&
    projects[0].organizationId === expected.organizationId
  )
}

function hasExactFact(
  facts: unknown[] | null,
  expected: AccountExportExpected,
): boolean {
  return (
    facts?.length === 1 &&
    isRecord(facts[0]) &&
    facts[0].id === expected.factId &&
    facts[0].propertyProjectId === expected.projectId &&
    facts[0].key === 'area.usable'
  )
}

function hasExactSource(
  sources: unknown[] | null,
  expected: AccountExportExpected,
): boolean {
  return (
    sources?.length === 1 &&
    isRecord(sources[0]) &&
    sources[0].id === expected.sourceId &&
    sources[0].organizationId === expected.organizationId &&
    sources[0].propertyProjectId === expected.projectId
  )
}

function hasExactProposalCollection(
  proposals: unknown[] | null,
  expected: AccountExportExpected,
): boolean {
  if (proposals?.length !== 2) return false
  try {
    parseProposalDecisionReadback(
      { proposals },
      {
        acceptedId: expected.acceptedProposalId,
        rejectedId: expected.rejectedProposalId,
        sourceId: expected.sourceId,
        jobId: expected.sourceJobId,
      },
    )
    return proposals.every(
      (proposal) =>
        isRecord(proposal) &&
        proposal.propertyProjectId === expected.projectId,
    )
  } catch {
    return false
  }
}

const expectedAuditEvidence = [
  ['property.created', 'projectId'],
  ['fact.created', 'factId'],
  ['fact.updated', 'factId'],
  ['source.registered', 'sourceId'],
  ['proposal.decided', 'acceptedProposalId'],
  ['proposal.decided', 'rejectedProposalId'],
] as const

function hasExpectedAuditEvidence(
  audit: unknown[] | null,
  expected: AccountExportExpected,
): boolean {
  return (
    audit !== null &&
    audit.length > 0 &&
    expectedAuditEvidence.every(([action, idKey]) =>
      audit.some(
        (entry) =>
          isRecord(entry) &&
          entry.propertyProjectId === expected.projectId &&
          entry.action === action &&
          entry.entityId === expected[idKey],
      ),
    )
  )
}

const expectedProjectEventNames = [
  'property.created',
  'fact.created',
  'fact.updated',
  'source.registered',
  'source.review_ready',
] as const

function hasExpectedStudioEvents(
  events: unknown[] | null,
  expected: AccountExportExpected,
): boolean {
  if (events === null || events.length === 0) return false
  const hasProjectEvents = expectedProjectEventNames.every(
    (name) =>
      events.some(
        (event) =>
          isRecord(event) &&
          event.name === name &&
          event.propertyProjectId === expected.projectId,
      ),
  )
  const proposalDecisionCount = events.filter(
    (event) =>
      isRecord(event) &&
      event.name === 'proposal.decided' &&
      event.propertyProjectId === expected.projectId,
  ).length
  return (
    hasProjectEvents &&
    proposalDecisionCount >= 2 &&
    hasAccountExportedEvent(events)
  )
}

function hasAccountExportedEvent(
  events: unknown[] | null,
): boolean {
  return (
    events !== null &&
    events.some(
      (event) =>
        isRecord(event) && event.name === 'account.exported',
    )
  )
}

const forbiddenCredentialKeys = new Set([
  'signedurl',
  'presignedurl',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'sessiontoken',
  'securitytoken',
  'bearertoken',
  'authorization',
  'authentication',
  'password',
  'clientsecret',
  'secret',
  'cookie',
  'setcookie',
  'xamzcredential',
  'xamzsignature',
  'xamzsecuritytoken',
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

const forbiddenCredentialValuePatterns = [
  /(?:^|[?&\s])X-Amz-(?:Algorithm|Credential|Date|Expires|SignedHeaders|Signature|Security-Token)=/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/i,
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/,
  /(?:^|[?&\s;])(?:access_?token|refresh_?token|id_?token|token|client_?secret|secret|authorization|cookie)\s*[:=]\s*\S+/i,
] as const

function containsForbiddenCredentialValue(
  value: unknown,
  seen = new WeakSet<object>(),
): boolean {
  if (typeof value === 'string') {
    return forbiddenCredentialValuePatterns.some((pattern) =>
      pattern.test(value),
    )
  }
  if (!value || typeof value !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)
  return Array.isArray(value)
    ? value.some((item) =>
        containsForbiddenCredentialValue(item, seen),
      )
    : Object.values(value).some((item) =>
        containsForbiddenCredentialValue(item, seen),
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

function hasOnboardingState(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.currentStep === 'string' &&
    value.currentStep.trim().length > 0 &&
    isRecord(value.expressAnswers) &&
    Object.keys(value.expressAnswers).length > 0
  )
}

const subscriptionPlans = new Set([
  'trial',
  'starter',
  'pro',
  'agency',
])
const subscriptionStatuses = new Set([
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'expired',
  'none',
])

function hasSubscriptionState(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.plan === 'string' &&
    subscriptionPlans.has(value.plan) &&
    typeof value.status === 'string' &&
    subscriptionStatuses.has(value.status)
  )
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
