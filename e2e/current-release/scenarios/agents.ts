import {
  createLegalNoHitProbeNonce,
  signLegalNoHitProbe,
} from '../../../src/features/current-release-acceptance/legal-probe'
import type { APIResponse } from '@playwright/test'
import {
  assertLegalNegativeSummary,
  assertLegalPositiveSummary,
  collectObservableModelId,
  summarizeAgentBody,
  type Task8BrowserHandoff,
} from '../ui-helpers'

export const agentCallMatrix = [
  ['ceo', 'plan-tygodnia'],
  ['marketing', 'karuzela-ig'],
  ['nieruchomosci', 'opis-oferty'],
  ['wycena', 'wycena-porownawcza'],
  ['publikacja', 'plan-publikacji'],
  ['prawny', 'pytanie-prawne'],
] as const

export async function runAgentScenarios(
  runtime: Task8BrowserHandoff,
): Promise<void> {
  const foreignMarker = `SYN-B-${runtime.fixtures.runId}`

  await runtime.runScenario(
    'agents.six',
    'AGENTS_SIX_FAILED',
    async () => {
      for (const [agentId, toolId] of agentCallMatrix) {
        await runtime.budget.runBefore('agent', async () => {
          const response = await callAgent(runtime, {
            agentId,
            toolId,
            context:
              `SYN-A-${runtime.fixtures.runId}; rynek Testowo; wyłącznie dane syntetyczne.`,
            goal:
              `Krótka odpowiedź testowa dla ${runtime.fixtures.runId}.`,
          })
          const body = await response.text()
          collectObservableModelId(
            await response.headers(),
            runtime.modelIds,
          )
          const summary = summarizeAgentBody(body, foreignMarker)
          if (
            !summary.nonEmpty ||
            summary.hasGenerationError ||
            summary.leaksForeignMarker
          ) {
            throw new Error('AGENT_RESPONSE_INVALID')
          }
        })
      }
    },
  )

  await runtime.runScenario(
    'agents.legal-positive',
    'AGENT_LEGAL_POSITIVE_FAILED',
    async () => {
      await runtime.budget.runBefore('agent', async () => {
        const response = await callAgent(runtime, {
          agentId: 'prawny',
          toolId: 'pytanie-prawne',
          context:
            `SYN-A-${runtime.fixtures.runId}; sprzedaż nieruchomości; dane syntetyczne.`,
          goal:
            'Jaka forma jest wymagana dla umowy przenoszącej własność nieruchomości? Podaj podstawę i numer artykułu.',
        })
        const body = await response.text()
        collectObservableModelId(
          await response.headers(),
          runtime.modelIds,
        )
        assertLegalPositiveSummary(body, foreignMarker)
      })
    },
  )

  await runtime.runScenario(
    'agents.legal-negative',
    'AGENT_LEGAL_NEGATIVE_FAILED',
    async () => {
      const nonce = createLegalNoHitProbeNonce()
      const expiresAt = Math.floor(Date.now() / 1000) + 45
      const signature = signLegalNoHitProbe({
        acceptanceSecret: runtime.fixtures.acceptanceSecret,
        runId: runtime.fixtures.runId,
        userId: runtime.userASubject,
        nonce,
        expiresAt,
      })

      await runtime.budget.runBefore('agent', async () => {
        const response = await callAgent(
          runtime,
          {
            agentId: 'prawny',
            toolId: 'pytanie-prawne',
            context:
              `SYN-A-${runtime.fixtures.runId}; kontrola braku trafienia; dane syntetyczne.`,
            goal:
              'Odpowiedz tylko w granicach przepisów znalezionych w bazie.',
          },
          {
            'x-current-release-run-id':
              runtime.fixtures.runId,
            'x-current-release-legal-no-hit': signature,
            'x-current-release-legal-nonce': nonce,
            'x-current-release-legal-expires-at':
              String(expiresAt),
          },
        )
        const body = await response.text()
        collectObservableModelId(
          await response.headers(),
          runtime.modelIds,
        )
        assertLegalNegativeSummary(body, foreignMarker)
      })
    },
  )

  const usage = runtime.budget.snapshot()
  if (
    usage.onboardingGenerationCalls !== 9 ||
    usage.agentCalls !== 8 ||
    usage.sourcePipelineCalls !== 0 ||
    usage.reservedUsd !== 1.18
  ) {
    throw new Error('CURRENT_RELEASE_TASK8_USAGE_INVALID')
  }
}

async function callAgent(
  runtime: Task8BrowserHandoff,
  data: {
    agentId: string
    toolId: string
    context: string
    goal: string
  },
  headers?: Record<string, string>,
): Promise<APIResponse> {
  const response = await runtime.contextA.request.post(
    '/api/agents/run',
    {
      data,
      headers,
    },
  )
  if (response.status() !== 200) {
    throw new Error('AGENT_RESPONSE_INVALID')
  }
  return response
}
