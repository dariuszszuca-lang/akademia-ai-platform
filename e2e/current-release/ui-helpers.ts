import type {
  BrowserContext,
  Page,
} from '@playwright/test'
import { z } from 'zod'
import {
  currentReleaseBrowserScenarioSchema,
  type CurrentReleaseBrowserScenario,
} from '../../src/features/current-release-acceptance/browser-result'
import type { CurrentReleaseFixtures } from './fixtures'
import type { CurrentReleaseScenarioRecorder } from './result'
import { createChildCostBudget } from './budget'
import type { ResolvedOperatorContext } from './operator'
import {
  AI_MODEL_ID_HEADER,
  safeModelIdSchema,
} from '../../src/lib/model-id'
import { LEGAL_NO_SOURCE_MESSAGE } from '../../src/lib/legal/fallback'

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

export type Task8BrowserHandoff = {
  fixtures: CurrentReleaseFixtures
  contextA: BrowserContext
  pageA: Page
  contextB: BrowserContext
  pageB: Page
  budget: ReturnType<typeof createChildCostBudget>
  operatorContext: ResolvedOperatorContext
  modelIds: Set<string>
  runScenario: Task8ScenarioRunner
  userASubject: string
  userBSubject: string
}

export function syntheticAnswer(
  runId: string,
  index: number,
  actor: 'a' | 'b',
): string {
  const actorLabel = actor.toUpperCase()
  return `Syntetyczna odpowiedź ${actorLabel}-${index + 1}; znacznik ${runId}; rynek Testowo.`
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
  foreignMarker: string,
): SafeAgentBodySummary {
  return {
    nonEmpty: body.trim().length > 0,
    hasGenerationError: body.includes('[Błąd generowania'),
    leaksForeignMarker:
      foreignMarker.length > 0 && body.includes(foreignMarker),
  }
}

export type LegalPositiveSummary = SafeAgentBodySummary & {
  nonEmptySources: boolean
  hasArticleSource: boolean
  hasArticleInAnswer: boolean
}

export function assertLegalPositiveSummary(
  body: string,
  foreignMarker: string,
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
  const base = summarizeAgentBody(answer, foreignMarker)
  const summary: LegalPositiveSummary = {
    ...base,
    nonEmptySources: parsed.data.sources.length > 0,
    hasArticleSource: parsed.data.sources.some(
      (source) => source.art.trim().length > 0,
    ),
    hasArticleInAnswer: /\bart\.?\s*\d+/i.test(answer),
  }
  if (
    !summary.nonEmpty ||
    !summary.nonEmptySources ||
    !summary.hasArticleSource ||
    !summary.hasArticleInAnswer ||
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
  foreignMarker: string,
): LegalNegativeSummary {
  const base = summarizeAgentBody(body, foreignMarker)
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
  },
>(input: T): T {
  cognitoSubjectSchema.parse(input.userASubject)
  cognitoSubjectSchema.parse(input.userBSubject)
  if (input.userASubject === input.userBSubject) {
    throw new Error('CURRENT_RELEASE_USERS_NOT_UNIQUE')
  }
  return input
}

function normalizeDuration(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs < 0) return 0
  return Math.min(Math.floor(durationMs), 3_600_000)
}
