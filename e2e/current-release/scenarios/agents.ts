import {
  createLegalNoHitProbeNonce,
  signLegalNoHitProbe,
} from '../../../src/features/current-release-acceptance/legal-probe'
import {
  assertLegalNegativeSummary,
  assertLegalPositiveSummary,
  calculateEphemeralStateExpiresAt,
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
  const foreignMarkers = runtime.foreignUserMarkers
  let legalReplayExpiresAt = 0

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
          collectObservableModelId(
            response.headers,
            runtime.modelIds,
          )
          const summary = summarizeAgentBody(
            response.body,
            foreignMarkers,
          )
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
        collectObservableModelId(
          response.headers,
          runtime.modelIds,
        )
        assertLegalPositiveSummary(
          response.body,
          foreignMarkers,
        )
      })
    },
  )

  await runtime.runScenario(
    'agents.legal-negative',
    'AGENT_LEGAL_NEGATIVE_FAILED',
    async () => {
      const nonce = createLegalNoHitProbeNonce()
      const expiresAt = Math.floor(Date.now() / 1000) + 45
      legalReplayExpiresAt = expiresAt
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
        collectObservableModelId(
          response.headers,
          runtime.modelIds,
        )
        assertLegalNegativeSummary(
          response.body,
          foreignMarkers,
        )
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
  runtime.networkLedger.reconcile(usage)
  runtime.ephemeralStateExpiresAt =
    calculateEphemeralStateExpiresAt(
      Date.now(),
      legalReplayExpiresAt,
    )
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
): Promise<{
  body: string
  headers: Record<string, string>
}> {
  const networkResponse = runtime.pageA.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/agents/run',
  )
  const browserResult = runtime.pageA.evaluate(
    async ({ requestData, requestHeaders }) => {
      const response = await fetch('/api/agents/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...requestHeaders,
        },
        body: JSON.stringify(requestData),
      })
      return {
        status: response.status,
        body: await response.text(),
      }
    },
    { requestData: data, requestHeaders: headers ?? {} },
  )
  const [observedResponse, result] = await Promise.all([
    networkResponse,
    browserResult,
  ])
  if (
    observedResponse.status() !== 200 ||
    result.status !== 200
  ) {
    throw new Error('AGENT_RESPONSE_INVALID')
  }
  return {
    body: result.body,
    headers: observedResponse.headers(),
  }
}
