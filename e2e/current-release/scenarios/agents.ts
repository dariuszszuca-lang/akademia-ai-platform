import {
  createLegalNoHitProbeNonce,
  signLegalNoHitProbe,
} from '../../../src/features/current-release-acceptance/legal-probe'
import {
  assertLegalNegativeSummary,
  assertLegalPositiveSummary,
  collectObservableModelId,
  isCanonicalProductionPost,
  normalizeForMarkerMatch,
  persistEphemeralStateBeforeRequest,
  summarizeAgentBody,
  TASK8_MAX_AGENT_CALLS,
  TASK8_REQUIRED_AGENT_CALLS,
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

const profileEvidenceInstruction =
  'Na początku odpowiedzi umieść dokładnie kod kontrolny zapisany w profilu użytkownika.'

export async function runAgentScenarios(
  runtime: Task8BrowserHandoff,
): Promise<void> {
  const foreignMarkers = runtime.foreignUserMarkers

  await runtime.runScenario(
    'agents.six',
    'AGENTS_SIX_FAILED',
    async () => {
      for (const [agentId, toolId] of agentCallMatrix) {
        let retried = false
        for (;;) {
          try {
            await runtime.budget.runBefore('agent', async () => {
              const response = await callAgent(runtime, {
                agentId,
                toolId,
                context:
                  `SYN-A-${runtime.fixtures.runId}; rynek Testowo; wyłącznie dane syntetyczne.`,
                goal:
                  `Krótka odpowiedź testowa dla ${runtime.fixtures.runId}. ${profileEvidenceInstruction}`,
              })
              collectObservableModelId(
                response.headers,
                runtime.modelIds,
              )
              const summary = summarizeAgentBody(
                response.body,
                foreignMarkers,
                runtime.profileMarker,
              )
              const failedChecks = [
                summary.nonEmpty ? null : 'EMPTY',
                summary.usedProfileMarker
                  ? null
                  : normalizeForMarkerMatch(
                        response.body,
                      ).includes('PROFILE-')
                    ? 'NO_MARKER_PREFIX'
                    : 'NO_MARKER_ABSENT',
                summary.hasGenerationError
                  ? 'GENERATION_ERROR'
                  : null,
                summary.leaksForeignMarker
                  ? 'FOREIGN_LEAK'
                  : null,
              ].filter(
                (token): token is string => token !== null,
              )
              if (failedChecks.length > 0) {
                // Constant tokens only (agent id + check names).
                throw new Error(
                  `AGENT_RESPONSE_INVALID_${agentId.toUpperCase()}` +
                    `_${failedChecks.join('_')}`,
                )
              }
            })
            break
          } catch (error) {
            // One accounted retry, only for a pure marker slip: the
            // agent answered with a valid 200 body but skipped the
            // profile control code. Every other failure stays fatal.
            if (
              retried ||
              !(error instanceof Error) ||
              !/^AGENT_RESPONSE_INVALID_[A-Z]+_NO_MARKER_(PREFIX|ABSENT)$/.test(
                error.message,
              )
            ) {
              throw error
            }
            retried = true
          }
        }
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
            `Jaka forma jest wymagana dla umowy przenoszącej własność nieruchomości? Podaj podstawę i numer artykułu. ${profileEvidenceInstruction}`,
        })
        collectObservableModelId(
          response.headers,
          runtime.modelIds,
        )
        assertLegalPositiveSummary(
          response.body,
          foreignMarkers,
          runtime.profileMarker,
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
              `Odpowiedz tylko w granicach przepisów znalezionych w bazie. ${profileEvidenceInstruction}`,
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
          runtime.profileMarker,
        )
      })
    },
  )

  const usage = runtime.budget.snapshot()
  const expectedReservedUsd =
    Math.round(
      (usage.onboardingGenerationCalls * 0.06 +
        usage.agentCalls * 0.08) *
        1_000_000,
    ) / 1_000_000
  if (
    usage.onboardingGenerationCalls !== 9 ||
    usage.agentCalls < TASK8_REQUIRED_AGENT_CALLS ||
    usage.agentCalls > TASK8_MAX_AGENT_CALLS ||
    usage.sourcePipelineCalls !== 0 ||
    usage.reservedUsd !== expectedReservedUsd
  ) {
    throw new Error('CURRENT_RELEASE_TASK8_USAGE_INVALID')
  }
  runtime.networkLedger.reconcile(usage)
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
  if (
    data.context.includes(runtime.profileMarker) ||
    data.goal.includes(runtime.profileMarker)
  ) {
    throw new Error('CURRENT_RELEASE_PROFILE_MARKER_IN_REQUEST')
  }
  return persistEphemeralStateBeforeRequest(
    runtime,
    async () => {
      const networkResponse = runtime.pageA.waitForResponse(
        (response) =>
          isCanonicalProductionPost({
            url: response.url(),
            method: response.request().method(),
            pathname: '/api/agents/run',
            baseUrl: runtime.fixtures.baseUrl,
          }),
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
        // Constant tokens only (agent id + status codes), no body.
        throw new Error(
          `AGENT_RESPONSE_INVALID_${data.agentId.toUpperCase()}` +
            `_${observedResponse.status()}_${result.status}`,
        )
      }
      return {
        body: result.body,
        headers: observedResponse.headers(),
      }
    },
  )
}
