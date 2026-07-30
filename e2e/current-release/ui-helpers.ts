import type {
  BrowserContext,
  Page,
} from '@playwright/test'
import { z } from 'zod'
import {
  currentReleaseBrowserScenarioSchema,
  type CurrentReleaseBrowserScenario,
} from '../../src/features/current-release-acceptance/browser-result'
import { currentReleaseRunIdSchema } from '../../src/features/current-release-acceptance/domain'
import type { CurrentReleaseFixtures } from './fixtures'
import type { CurrentReleaseScenarioRecorder } from './result'
import { createChildCostBudget } from './budget'
import type { ResolvedOperatorContext } from './operator'
import {
  AI_MODEL_ID_HEADER,
  safeModelIdSchema,
} from '../../src/lib/model-id'
import { LEGAL_NO_SOURCE_MESSAGE } from '../../src/lib/legal/fallback'
import { CURRENT_RELEASE_LEGAL_PROBE_MAX_TTL_SECONDS } from '../../src/features/current-release-acceptance/legal-probe'

const cognitoSubjectSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )

export const task8BrowserScenarios = [
  'auth.registration',
  'auth.session',
  'onboarding.express',
  'onboarding.path-a',
  'onboarding.path-b',
  'onboarding.deep',
  'agents.six',
  'agents.legal-positive',
  'agents.legal-negative',
] as const satisfies readonly CurrentReleaseBrowserScenario[]

export type Task8ScenarioName =
  (typeof task8BrowserScenarios)[number]

export type Task8ScenarioRunner = (
  name: CurrentReleaseBrowserScenario,
  errorCode: string,
  action: () => Promise<void>,
) => Promise<void>

export type Task8EphemeralStateRuntime = {
  ephemeralStateExpiresAt: number
  recordEphemeralStateExpiresAt(
    expiresAt: number,
  ): Promise<void>
}

export type Task8BrowserHandoff = {
  fixtures: CurrentReleaseFixtures
  contextA: BrowserContext
  pageA: Page
  contextB: BrowserContext
  pageB: Page
  budget: ReturnType<typeof createChildCostBudget>
  operatorContext: ResolvedOperatorContext
  modelIds: Set<string>
  networkLedger: Task8NetworkLedger
  runScenario: Task8ScenarioRunner
  foreignUserMarkers: readonly string[]
  userASubject: string
  userBSubject: string
} & Task8EphemeralStateRuntime

const PRODUCTION_ORIGIN =
  'https://akademia-ai-platform.vercel.app'
const RATE_LIMIT_WINDOW_SECONDS = 60
const RATE_LIMIT_TTL_MARGIN_SECONDS = 5
const CLEANUP_SETTLE_MARGIN_SECONDS = 5

const task8OnboardingModelPaths = new Set([
  '/api/onboarding/generate-profil',
  '/api/onboarding/persona/types',
  '/api/onboarding/persona/expand',
  '/api/onboarding/persona/generate',
  '/api/onboarding/generate-deep',
])

export const expectedTask8ModelCallSequence = [
  {
    kind: 'onboarding',
    pathname: '/api/onboarding/generate-profil',
  },
  {
    kind: 'onboarding',
    pathname: '/api/onboarding/persona/types',
  },
  {
    kind: 'onboarding',
    pathname: '/api/onboarding/persona/expand',
  },
  {
    kind: 'onboarding',
    pathname: '/api/onboarding/persona/types',
  },
  {
    kind: 'onboarding',
    pathname: '/api/onboarding/persona/expand',
  },
  {
    kind: 'onboarding',
    pathname: '/api/onboarding/generate-profil',
  },
  {
    kind: 'onboarding',
    pathname: '/api/onboarding/persona/generate',
  },
  {
    kind: 'onboarding',
    pathname: '/api/onboarding/persona/generate',
  },
  {
    kind: 'onboarding',
    pathname: '/api/onboarding/generate-deep',
  },
  ...Array.from({ length: 8 }, () => ({
    kind: 'agent' as const,
    pathname: '/api/agents/run' as const,
  })),
] as const

type ObservedModelCall = {
  kind: 'onboarding' | 'agent'
  pathname: string
  status: number | null
}

export type Task8NetworkLedger = {
  attach(context: BrowserContext): () => void
  observeRequest(
    requestId: unknown,
    method: string,
    url: string,
  ): void
  observeResponse(requestId: unknown, status: number): void
  reconcile(
    budget: ReturnType<
      ReturnType<typeof createChildCostBudget>['snapshot']
    >,
  ): {
    onboardingGenerationCalls: 9
    agentCalls: 8
  }
  snapshot(): ObservedModelCall[]
}

export function createTask8NetworkLedger(): Task8NetworkLedger {
  const calls: ObservedModelCall[] = []
  const requestIndexes = new Map<unknown, number>()
  let invalid = false

  function observeRequest(
    requestId: unknown,
    method: string,
    rawUrl: string,
  ): void {
    if (method !== 'POST') return
    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      return
    }
    if (url.origin !== PRODUCTION_ORIGIN) return
    const kind = classifyModelPath(url.pathname)
    if (!kind) return
    if (requestIndexes.has(requestId)) {
      invalid = true
      return
    }
    requestIndexes.set(requestId, calls.length)
    calls.push({
      kind,
      pathname: url.pathname,
      status: null,
    })
  }

  function observeResponse(
    requestId: unknown,
    status: number,
  ): void {
    const index = requestIndexes.get(requestId)
    if (index === undefined) return
    const call = calls[index]
    if (!call || call.status !== null) {
      invalid = true
      return
    }
    call.status = status
  }

  return {
    attach(context) {
      const onRequest = (request: {
        method(): string
        url(): string
      }) => {
        observeRequest(
          request,
          request.method(),
          request.url(),
        )
      }
      const onResponse = (response: {
        request(): unknown
        status(): number
      }) => {
        observeResponse(response.request(), response.status())
      }
      context.on('request', onRequest)
      context.on('response', onResponse)
      return () => {
        context.off('request', onRequest)
        context.off('response', onResponse)
      }
    },

    observeRequest,
    observeResponse,

    reconcile(budget) {
      if (
        invalid ||
        calls.length !== expectedTask8ModelCallSequence.length ||
        calls.some(
          (call, index) =>
            call.kind !==
              expectedTask8ModelCallSequence[index]!.kind ||
            call.pathname !==
              expectedTask8ModelCallSequence[index]!.pathname ||
            call.status === null ||
            call.status < 200 ||
            call.status >= 300,
        )
      ) {
        throw new Error('CURRENT_RELEASE_NETWORK_LEDGER_INVALID')
      }
      const onboardingGenerationCalls = calls.filter(
        (call) => call.kind === 'onboarding',
      ).length
      const agentCalls = calls.filter(
        (call) => call.kind === 'agent',
      ).length
      if (
        onboardingGenerationCalls !== 9 ||
        agentCalls !== 8 ||
        budget.onboardingGenerationCalls !==
          onboardingGenerationCalls ||
        budget.agentCalls !== agentCalls ||
        budget.sourcePipelineCalls !== 0 ||
        budget.reservedUsd !== 1.18
      ) {
        throw new Error(
          'CURRENT_RELEASE_NETWORK_BUDGET_MISMATCH',
        )
      }
      return {
        onboardingGenerationCalls: 9,
        agentCalls: 8,
      }
    },

    snapshot() {
      return calls.map((call) => ({ ...call }))
    },
  }
}

export function syntheticAnswer(
  runId: string,
  index: number,
  actor: 'a' | 'b',
): string {
  const actorLabel = actor.toUpperCase()
  return `Syntetyczna odpowiedź ${actorLabel}-${index + 1}; znacznik ${runId}; rynek Testowo.`
}

export function buildForeignUserMarkers(
  input: {
    runId: string
    userB: string
    userBSubject: string
  },
): readonly string[] {
  const runId = currentReleaseRunIdSchema.parse(input.runId)
  cognitoSubjectSchema.parse(input.userBSubject)
  if (
    input.userB !==
    `synthetic-release-${runId}-b@example.invalid`
  ) {
    throw new Error('CURRENT_RELEASE_FOREIGN_MARKERS_INVALID')
  }
  const markers = [
    'Syntetyczna odpowiedź B-',
    `SYN-B-${runId}-buyer-`,
    `SYN-B-${runId}-seller-`,
    input.userB,
    input.userBSubject,
  ]
  if (
    markers.some((marker) => marker.length < 8) ||
    new Set(markers).size !== markers.length
  ) {
    throw new Error('CURRENT_RELEASE_FOREIGN_MARKERS_INVALID')
  }
  return Object.freeze(markers)
}

export function collectObservableModelId(
  headers: Headers | Record<string, string>,
  modelIds: Set<string>,
): string {
  const raw =
    headers instanceof Headers
      ? headers.get(AI_MODEL_ID_HEADER)
      : headers[AI_MODEL_ID_HEADER]
  const parsed = safeModelIdSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error('CURRENT_RELEASE_MODEL_ID_MISSING')
  }
  modelIds.add(parsed.data)
  return parsed.data
}

export type SafeAgentBodySummary = {
  nonEmpty: boolean
  hasGenerationError: boolean
  leaksForeignMarker: boolean
}

export function summarizeAgentBody(
  body: string,
  foreignMarkers: readonly string[],
): SafeAgentBodySummary {
  return {
    nonEmpty: body.trim().length > 0,
    hasGenerationError: body.includes('[Błąd generowania'),
    leaksForeignMarker: foreignMarkers.some(
      (marker) => marker.length > 0 && body.includes(marker),
    ),
  }
}

export type LegalPositiveSummary = SafeAgentBodySummary & {
  nonEmptySources: boolean
  hasArticleSource: boolean
  hasArticleInAnswer: boolean
  hasMatchingArticleCitation: boolean
}

export function assertLegalPositiveSummary(
  body: string,
  foreignMarkers: readonly string[],
): LegalPositiveSummary {
  const match = body.match(
    /^\[\[META\]\](\{[^\n]*\})\[\[\/META\]\]\n([\s\S]*)$/,
  )
  if (!match) {
    throw new Error('CURRENT_RELEASE_LEGAL_POSITIVE_INVALID')
  }

  let metadata: unknown
  try {
    metadata = JSON.parse(match[1]!)
  } catch {
    throw new Error('CURRENT_RELEASE_LEGAL_POSITIVE_INVALID')
  }
  const parsed = z
    .object({
      sources: z
        .array(
          z
            .object({
              art: z.string(),
            })
            .passthrough(),
        )
        .min(1),
    })
    .passthrough()
    .safeParse(metadata)
  if (!parsed.success) {
    throw new Error('CURRENT_RELEASE_LEGAL_POSITIVE_INVALID')
  }

  const answer = match[2]!
  const sourceArticles = new Set(
    parsed.data.sources.flatMap((source) =>
      extractArticleNumbers(source.art),
    ),
  )
  const answerArticles = extractCitedArticleNumbers(answer)
  const base = summarizeAgentBody(answer, foreignMarkers)
  const summary: LegalPositiveSummary = {
    ...base,
    nonEmptySources: parsed.data.sources.length > 0,
    hasArticleSource: sourceArticles.size > 0,
    hasArticleInAnswer: answerArticles.length > 0,
    hasMatchingArticleCitation: answerArticles.some((article) =>
      sourceArticles.has(article),
    ),
  }
  if (
    !summary.nonEmpty ||
    !summary.nonEmptySources ||
    !summary.hasArticleSource ||
    !summary.hasArticleInAnswer ||
    !summary.hasMatchingArticleCitation ||
    summary.hasGenerationError ||
    summary.leaksForeignMarker
  ) {
    throw new Error('CURRENT_RELEASE_LEGAL_POSITIVE_INVALID')
  }
  return summary
}

export type LegalNegativeSummary = Omit<
  SafeAgentBodySummary,
  'nonEmpty'
> & {
  hasNoSourceMessage: boolean
  hasMetadata: boolean
}

export function assertLegalNegativeSummary(
  body: string,
  foreignMarkers: readonly string[],
): LegalNegativeSummary {
  const base = summarizeAgentBody(body, foreignMarkers)
  const summary: LegalNegativeSummary = {
    hasNoSourceMessage: body.startsWith(LEGAL_NO_SOURCE_MESSAGE),
    hasMetadata:
      body.includes('[[META]]') || body.includes('[[/META]]'),
    hasGenerationError: base.hasGenerationError,
    leaksForeignMarker: base.leaksForeignMarker,
  }
  if (
    !base.nonEmpty ||
    !summary.hasNoSourceMessage ||
    summary.hasMetadata ||
    summary.hasGenerationError ||
    summary.leaksForeignMarker
  ) {
    throw new Error('CURRENT_RELEASE_LEGAL_NEGATIVE_INVALID')
  }
  return summary
}

export function createScenarioRunner(
  recorder: CurrentReleaseScenarioRecorder,
  now: () => number = Date.now,
): Task8ScenarioRunner {
  return async (name, errorCode, action) => {
    const parsedName = currentReleaseBrowserScenarioSchema.parse(name)
    const startedAt = now()
    try {
      await action()
      recorder.pass(
        parsedName,
        normalizeDuration(now() - startedAt),
      )
    } catch {
      recorder.fail(
        parsedName,
        normalizeDuration(now() - startedAt),
        errorCode,
      )
      throw new Error(errorCode)
    }
  }
}

export function buildTask8BrowserHandoff<
  T extends {
    userASubject: string
    userBSubject: string
    foreignUserMarkers: readonly string[]
    ephemeralStateExpiresAt: number
    recordEphemeralStateExpiresAt(
      expiresAt: number,
    ): Promise<void>
  },
>(input: T): T {
  cognitoSubjectSchema.parse(input.userASubject)
  cognitoSubjectSchema.parse(input.userBSubject)
  if (input.userASubject === input.userBSubject) {
    throw new Error('CURRENT_RELEASE_USERS_NOT_UNIQUE')
  }
  if (
    input.foreignUserMarkers.length < 5 ||
    new Set(input.foreignUserMarkers).size !==
      input.foreignUserMarkers.length ||
    !Number.isSafeInteger(input.ephemeralStateExpiresAt) ||
    input.ephemeralStateExpiresAt <= 0 ||
    typeof input.recordEphemeralStateExpiresAt !== 'function'
  ) {
    throw new Error('CURRENT_RELEASE_HANDOFF_INVALID')
  }
  return input
}

export function calculateEphemeralStateExpiresAt(
  observedAtMs: number,
  replayExpiresAtEpochSeconds: number,
): number {
  if (
    !Number.isSafeInteger(observedAtMs) ||
    observedAtMs <= 0 ||
    !Number.isSafeInteger(replayExpiresAtEpochSeconds) ||
    replayExpiresAtEpochSeconds <= 0
  ) {
    throw new Error('CURRENT_RELEASE_EPHEMERAL_EXPIRY_INVALID')
  }
  const observedAtSeconds = Math.floor(observedAtMs / 1000)
  const rateWindowExpiresAt =
    (Math.floor(observedAtSeconds / RATE_LIMIT_WINDOW_SECONDS) +
      1) *
      RATE_LIMIT_WINDOW_SECONDS +
    RATE_LIMIT_TTL_MARGIN_SECONDS
  return (
    Math.max(rateWindowExpiresAt, replayExpiresAtEpochSeconds) +
    CLEANUP_SETTLE_MARGIN_SECONDS
  )
}

export function markAgentRequestEphemeralState(
  target: { ephemeralStateExpiresAt: number },
  observedAtMs: number = Date.now(),
): number {
  const replayExpiresAtEpochSeconds =
    Math.floor(observedAtMs / 1000) +
    CURRENT_RELEASE_LEGAL_PROBE_MAX_TTL_SECONDS
  const expiresAt = calculateEphemeralStateExpiresAt(
    observedAtMs,
    replayExpiresAtEpochSeconds,
  )
  target.ephemeralStateExpiresAt = Math.max(
    target.ephemeralStateExpiresAt,
    expiresAt,
  )
  return target.ephemeralStateExpiresAt
}

export async function persistEphemeralStateBeforeRequest<T>(
  target: Task8EphemeralStateRuntime,
  action: () => Promise<T>,
  observedAtMs: number = Date.now(),
): Promise<T> {
  const expiresAt = markAgentRequestEphemeralState(
    target,
    observedAtMs,
  )
  await target.recordEphemeralStateExpiresAt(expiresAt)
  return action()
}

export function isCanonicalProductionPost(input: {
  url: string
  method: string
  pathname: string
  baseUrl: string
}): boolean {
  if (
    input.baseUrl !== PRODUCTION_ORIGIN ||
    input.method !== 'POST'
  ) {
    return false
  }
  try {
    const url = new URL(input.url)
    return (
      url.origin === PRODUCTION_ORIGIN &&
      url.pathname === input.pathname &&
      url.search === '' &&
      url.hash === ''
    )
  } catch {
    return false
  }
}

function normalizeDuration(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs < 0) return 0
  return Math.min(Math.floor(durationMs), 3_600_000)
}

function classifyModelPath(
  pathname: string,
): 'onboarding' | 'agent' | null {
  if (task8OnboardingModelPaths.has(pathname)) {
    return 'onboarding'
  }
  return pathname === '/api/agents/run' ? 'agent' : null
}

function extractArticleNumbers(value: string): string[] {
  return (
    value
      .toLowerCase()
      .match(/\d+[a-z]?(?:\^\d+)?/g) ?? []
  )
}

function extractCitedArticleNumbers(value: string): string[] {
  return Array.from(
    value
      .toLowerCase()
      .matchAll(/\bart\.?\s*(\d+[a-z]?(?:\^\d+)?)/g),
    (match) => match[1]!,
  )
}
