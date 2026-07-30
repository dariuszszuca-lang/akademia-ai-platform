import type { BrowserContext } from '@playwright/test'
import { expressQuestions } from '../../../src/data/onboarding/express'
import {
  assertOnboardingResetEvidence,
  summarizeOnboardingArtifacts,
} from '../onboarding-evidence'
import { syntheticAnswer, type Task8ScenarioRunner } from '../ui-helpers'

type OnboardingResetRuntime = {
  fixtures: {
    runId: string
    adminPassword: string
  }
  contextA: BrowserContext
  contextB: BrowserContext
  runScenario: Task8ScenarioRunner
}

export async function runOnboardingResetScenario(
  runtime: OnboardingResetRuntime,
): Promise<void> {
  await runtime.runScenario(
    'onboarding.reset',
    'ONBOARDING_RESET_FAILED',
    async () => {
      const [beforeA, beforeB] = await Promise.all([
        readArtifactSummary(runtime.contextA),
        readArtifactSummary(runtime.contextB),
      ])

      const reset = await runtime.contextA.request.post(
        '/api/onboarding/reset',
        {
          headers: {
            authorization: `Bearer ${runtime.fixtures.adminPassword}`,
          },
        },
      )
      assertResetResponse(
        reset.status(),
        await readJson(reset),
      )

      const [afterA, afterB] = await Promise.all([
        readArtifactSummary(runtime.contextA),
        readArtifactSummary(runtime.contextB),
      ])
      assertOnboardingResetEvidence({
        beforeA,
        beforeB,
        afterA,
        afterB,
      })

      const question = expressQuestions[0]
      if (!question) {
        throw new Error('ONBOARDING_RESET_RESTORE_INVALID')
      }
      const answer = syntheticAnswer(
        runtime.fixtures.runId,
        0,
        'a',
      )
      const restored = await runtime.contextA.request.post(
        '/api/onboarding/save-answer',
        {
          data: {
            questionId: question.id,
            answer,
          },
        },
      )
      if (restored.status() !== 200) {
        throw new Error('ONBOARDING_RESET_RESTORE_INVALID')
      }

      const stateResponse = await runtime.contextA.request.get(
        '/api/onboarding/state',
      )
      if (stateResponse.status() !== 200) {
        throw new Error('ONBOARDING_RESET_RESTORE_INVALID')
      }
      assertMinimalRestoredState(
        await readJson(stateResponse),
        question.id,
        answer,
      )
    },
  )
}

async function readArtifactSummary(context: BrowserContext) {
  const response = await context.request.get('/api/account/export')
  if (response.status() !== 200) {
    throw new Error('ONBOARDING_RESET_EXPORT_INVALID')
  }
  return summarizeOnboardingArtifacts(await readJson(response))
}

function assertResetResponse(
  status: number,
  payload: unknown,
): void {
  if (
    status !== 200 ||
    !isRecord(payload) ||
    payload.ok !== true ||
    !Array.isArray(payload.cleared) ||
    payload.cleared.length !== 4 ||
    typeof payload.userId !== 'string' ||
    payload.userId.length < 1
  ) {
    throw new Error('ONBOARDING_RESET_RESPONSE_INVALID')
  }
}

function assertMinimalRestoredState(
  payload: unknown,
  questionId: string,
  answer: string,
): void {
  if (
    !isRecord(payload) ||
    payload.hasProfilMd !== false ||
    !isRecord(payload.state)
  ) {
    throw new Error('ONBOARDING_RESET_RESTORE_INVALID')
  }
  const state = payload.state
  if (
    state.currentStep !== 'express' ||
    !isRecord(state.expressAnswers) ||
    Object.keys(state.expressAnswers).length !== 1 ||
    state.expressAnswers[questionId] !== answer ||
    !isEmptyPersonaState(state.personaBuyer) ||
    !isEmptyPersonaState(state.personaSeller) ||
    !isRecord(state.deepAnswers) ||
    Object.keys(state.deepAnswers).length !== 0
  ) {
    throw new Error('ONBOARDING_RESET_RESTORE_INVALID')
  }
}

function isEmptyPersonaState(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.path === null &&
    isRecord(value.answers) &&
    Object.keys(value.answers).length === 0
  )
}

async function readJson(response: {
  json(): Promise<unknown>
}): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new Error('ONBOARDING_RESET_RESPONSE_INVALID')
  }
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
