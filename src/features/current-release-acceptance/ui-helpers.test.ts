import { describe, expect, it, vi } from 'vitest'
import {
  assertLegalNegativeSummary,
  assertLegalPositiveSummary,
  buildTask8BrowserHandoff,
  buildForeignUserMarkers,
  calculateEphemeralStateExpiresAt,
  collectObservableModelId,
  createTask8NetworkLedger,
  createScenarioRunner,
  expectedTask8ModelCallSequence,
  isCanonicalProductionPost,
  markAgentRequestEphemeralState,
  persistEphemeralStateBeforeRequest,
  summarizeAgentBody,
  syntheticAnswer,
  task8BrowserScenarios,
} from '../../../e2e/current-release/ui-helpers'
import { onboardingGenerationPlan } from '../../../e2e/current-release/scenarios/auth-onboarding'
import { agentCallMatrix } from '../../../e2e/current-release/scenarios/agents'

const runId = 'syn-20260729T220000Z-deadbeef'
const profileMarkerA =
  `PROFILE-A-${runId}-CONTEXT-PROOF`
const profileMarkerB =
  `PROFILE-B-${runId}-CONTEXT-PROOF`

describe('current release UI helpers', () => {
  it('builds deterministic answers with an actor-specific run marker', () => {
    expect(syntheticAnswer(runId, 0, 'a')).toBe(
      `Syntetyczna odpowiedź A-1; znacznik ${runId}; rynek Testowo. Stała instrukcja dla AI: zachowaj dosłownie kod kontrolny ${profileMarkerA} w zapisanym profilu i umieszczaj go w każdej odpowiedzi agenta.`,
    )
    expect(syntheticAnswer(runId, 0, 'b')).toBe(
      `Syntetyczna odpowiedź B-1; znacznik ${runId}; rynek Testowo. Stała instrukcja dla AI: zachowaj dosłownie kod kontrolny ${profileMarkerB} w zapisanym profilu i umieszczaj go w każdej odpowiedzi agenta.`,
    )
    expect(syntheticAnswer(runId, 0, 'a')).not.toContain(
      profileMarkerB,
    )
    expect(syntheticAnswer(runId, 0, 'b')).not.toContain(
      profileMarkerA,
    )
  })

  it('collects only safe observable model identifiers', () => {
    const modelIds = new Set<string>()

    collectObservableModelId(
      new Headers({ 'x-ai-model-id': 'claude-haiku-4-5-20251001' }),
      modelIds,
    )
    collectObservableModelId(
      new Headers({
        'x-ai-model-id':
          'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
      }),
      modelIds,
    )

    expect([...modelIds]).toEqual([
      'claude-haiku-4-5-20251001',
      'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
    ])
    expect(() =>
      collectObservableModelId(new Headers(), modelIds),
    ).toThrow('CURRENT_RELEASE_MODEL_ID_MISSING')
    expect(() =>
      collectObservableModelId(
        new Headers({ 'x-ai-model-id': 'sk-ant-secret' }),
        modelIds,
      ),
    ).toThrow('CURRENT_RELEASE_MODEL_ID_MISSING')
  })

  it('reduces an agent stream to booleans without returning content', () => {
    expect(
      summarizeAgentBody(
        `Bezpieczna odpowiedź ${profileMarkerA}`,
        ['SYN-B-deadbeef'],
        profileMarkerA,
      ),
    ).toEqual({
      nonEmpty: true,
      usedProfileMarker: true,
      hasGenerationError: false,
      leaksForeignMarker: false,
    })
    expect(
      summarizeAgentBody(
        `[Błąd generowania: provider failed] SYN-B-deadbeef ${profileMarkerA}`,
        ['SYN-B-deadbeef'],
        profileMarkerA,
      ),
    ).toEqual({
      nonEmpty: true,
      usedProfileMarker: true,
      hasGenerationError: true,
      leaksForeignMarker: true,
    })
    expect(
      JSON.stringify(
        summarizeAgentBody(
          `Odpowiedź ${profileMarkerA}`,
          [profileMarkerB],
          profileMarkerA,
        ),
      ),
    ).not.toContain(profileMarkerA)
  })

  it('detects every actual B marker, not only the path-B prefix', () => {
    const markers = buildForeignUserMarkers({
      runId,
      userB:
        `synthetic-release-${runId}-b@example.invalid`,
      userBSubject:
        '22222222-2222-4222-8222-222222222222',
    })
    expect(markers).toEqual([
      'Syntetyczna odpowiedź B-',
      `SYN-B-${runId}-buyer-`,
      `SYN-B-${runId}-seller-`,
      `synthetic-release-${runId}-b@example.invalid`,
      '22222222-2222-4222-8222-222222222222',
      profileMarkerB,
    ])
    expect(
      summarizeAgentBody(
        `Wyciek Syntetyczna odpowiedź B-1 ${profileMarkerA}`,
        markers,
        profileMarkerA,
      ).leaksForeignMarker,
    ).toBe(true)
    expect(
      summarizeAgentBody(
        `Wyciek SYN-B-${runId}-seller-4 ${profileMarkerA}`,
        markers,
        profileMarkerA,
      ).leaksForeignMarker,
    ).toBe(true)
    expect(
      summarizeAgentBody(
        `Wyciek ${profileMarkerB} ${profileMarkerA}`,
        markers,
        profileMarkerA,
      ).leaksForeignMarker,
    ).toBe(true)
  })

  it('summarizes positive legal metadata and article evidence', () => {
    const summary = assertLegalPositiveSummary(
      `[[META]]{"sources":[{"id":"s1","ustawa":"Kodeks cywilny","art":"158","ksiega":"","url":"","score":0.93}]}[[/META]]\n${profileMarkerA} Forma wynika z art. 158.`,
      ['SYN-B-deadbeef'],
      profileMarkerA,
    )

    expect(summary).toEqual({
      nonEmpty: true,
      usedProfileMarker: true,
      nonEmptySources: true,
      hasArticleSource: true,
      hasArticleInAnswer: true,
      hasMatchingArticleCitation: true,
      hasGenerationError: false,
      leaksForeignMarker: false,
    })
    expect(Object.keys(summary)).not.toContain('answer')
    expect(Object.keys(summary)).not.toContain('sources')
    expect(JSON.stringify(summary)).not.toContain(profileMarkerA)
  })

  it('rejects a cited article that differs from every source article', () => {
    expect(() =>
      assertLegalPositiveSummary(
        `[[META]]{"sources":[{"id":"s1","ustawa":"Kodeks cywilny","art":"999","ksiega":"","url":"","score":0.93}]}[[/META]]\n${profileMarkerA} Forma wynika z art. 158.`,
        ['SYN-B-deadbeef'],
        profileMarkerA,
      ),
    ).toThrow('CURRENT_RELEASE_LEGAL_POSITIVE_INVALID')
  })

  it('requires deterministic legal no-hit evidence without metadata', () => {
    expect(
      assertLegalNegativeSummary(
        `W bazie nie znalazłem przepisu wprost odnoszącego się do tego pytania\n\n${profileMarkerA} Odpowiedź.`,
        ['SYN-B-deadbeef'],
        profileMarkerA,
      ),
    ).toEqual({
      usedProfileMarker: true,
      hasNoSourceMessage: true,
      hasMetadata: false,
      hasGenerationError: false,
      leaksForeignMarker: false,
    })
    expect(() =>
      assertLegalNegativeSummary(
        '[[META]]{"sources":[]}[[/META]]',
        ['SYN-B-deadbeef'],
        profileMarkerA,
      ),
    ).toThrow('CURRENT_RELEASE_LEGAL_NEGATIVE_INVALID')
  })

  it('records safe scenario timing and a stable failure code', async () => {
    const recorder = {
      pass: vi.fn(),
      fail: vi.fn(),
      finalize: vi.fn(),
    }
    const runScenario = createScenarioRunner(recorder, (() => {
      let now = 100
      return () => {
        now += 25
        return now
      }
    })())

    await runScenario(
      'auth.registration',
      'AUTH_REGISTRATION_FAILED',
      async () => {},
    )
    expect(recorder.pass).toHaveBeenCalledWith(
      'auth.registration',
      25,
    )

    await expect(
      runScenario(
        'auth.session',
        'AUTH_SESSION_FAILED',
        async () => {
          throw new Error('sensitive provider detail')
        },
      ),
    ).rejects.toThrow('AUTH_SESSION_FAILED')
    expect(recorder.fail).toHaveBeenCalledWith(
      'auth.session',
      25,
      'AUTH_SESSION_FAILED',
    )
  })

  it('owns exactly the nine Task 8 functional scenarios', () => {
    expect(task8BrowserScenarios).toEqual([
      'auth.registration',
      'auth.session',
      'onboarding.express',
      'onboarding.path-a',
      'onboarding.path-b',
      'onboarding.deep',
      'agents.six',
      'agents.legal-positive',
      'agents.legal-negative',
    ])
  })

  it('reserves exactly the nine approved onboarding generations', () => {
    expect(onboardingGenerationPlan).toEqual([
      'a.express',
      'a.buyer.types',
      'a.buyer.expand',
      'a.seller.types',
      'a.seller.expand',
      'b.express',
      'b.buyer.generate',
      'b.seller.generate',
      'b.deep',
    ])
  })

  it('calls the exact six-agent matrix before legal evidence calls', () => {
    expect(agentCallMatrix).toEqual([
      ['ceo', 'plan-tygodnia'],
      ['marketing', 'karuzela-ig'],
      ['nieruchomosci', 'opis-oferty'],
      ['wycena', 'wycena-porownawcza'],
      ['publikacja', 'plan-publikacji'],
      ['prawny', 'pytanie-prawne'],
    ])
  })

  it('reconciles exactly 9 onboarding and 8 agent production calls', () => {
    const ledger = createTask8NetworkLedger()
    for (const [index, call] of expectedTask8ModelCallSequence.entries()) {
      const id = `call-${index}`
      ledger.observeRequest(
        id,
        'POST',
        `https://akademia-ai-platform.vercel.app${call.pathname}`,
      )
      ledger.observeResponse(id, 200)
    }

    expect(
      ledger.reconcile({
        onboardingGenerationCalls: 9,
        agentCalls: 8,
        sourcePipelineCalls: 0,
        reservedUsd: 1.18,
      }),
    ).toEqual({
      onboardingGenerationCalls: 9,
      agentCalls: 8,
    })
  })

  it.each([
    'missing',
    'duplicate',
    'extra',
    'order',
    'failed-status',
  ])('rejects an observed ledger with %s calls', (defect) => {
    const ledger = createTask8NetworkLedger()
    let calls = [...expectedTask8ModelCallSequence]
    if (defect === 'missing') calls = calls.slice(0, -1)
    if (defect === 'duplicate') {
      calls.splice(1, 0, calls[0]!)
    }
    if (defect === 'extra') {
      calls.push({
        kind: 'agent',
        pathname: '/api/agents/run',
      })
    }
    if (defect === 'order') {
      ;[calls[0], calls[1]] = [calls[1]!, calls[0]!]
    }
    for (const [index, call] of calls.entries()) {
      const id = `call-${index}`
      ledger.observeRequest(
        id,
        'POST',
        `https://akademia-ai-platform.vercel.app${call.pathname}`,
      )
      ledger.observeResponse(
        id,
        defect === 'failed-status' && index === 0 ? 500 : 200,
      )
    }

    expect(() =>
      ledger.reconcile({
        onboardingGenerationCalls: 9,
        agentCalls: 8,
        sourcePipelineCalls: 0,
        reservedUsd: 1.18,
      }),
    ).toThrow('CURRENT_RELEASE_NETWORK_LEDGER_INVALID')
  })

  it('rejects a budget that disagrees with observed calls', () => {
    const ledger = createTask8NetworkLedger()
    for (const [index, call] of expectedTask8ModelCallSequence.entries()) {
      const id = `call-${index}`
      ledger.observeRequest(
        id,
        'POST',
        `https://akademia-ai-platform.vercel.app${call.pathname}`,
      )
      ledger.observeResponse(id, 200)
    }

    expect(() =>
      ledger.reconcile({
        onboardingGenerationCalls: 8,
        agentCalls: 8,
        sourcePipelineCalls: 0,
        reservedUsd: 1.12,
      }),
    ).toThrow('CURRENT_RELEASE_NETWORK_BUDGET_MISMATCH')
  })

  it('ignores non-production and non-POST observations', () => {
    const ledger = createTask8NetworkLedger()
    ledger.observeRequest(
      'local',
      'POST',
      'http://127.0.0.1:3000/api/agents/run',
    )
    ledger.observeResponse('local', 200)
    ledger.observeRequest(
      'get',
      'GET',
      'https://akademia-ai-platform.vercel.app/api/agents/run',
    )
    ledger.observeResponse('get', 200)
    expect(ledger.snapshot()).toEqual([])
  })

  it('exposes a conservative secret-free ephemeral expiry', () => {
    expect(
      calculateEphemeralStateExpiresAt(
        Date.UTC(2026, 6, 29, 22, 0, 20),
        Math.floor(Date.UTC(2026, 6, 29, 22, 1, 5) / 1000),
      ),
    ).toBe(
      Math.floor(Date.UTC(2026, 6, 29, 22, 1, 10) / 1000),
    )
  })

  it('advances the ephemeral deadline before every slow agent call, including a failed fifth call', () => {
    const target = { ephemeralStateExpiresAt: 1 }
    const callTimes = [
      Date.UTC(2026, 6, 29, 22, 0, 1),
      Date.UTC(2026, 6, 29, 22, 1, 11),
      Date.UTC(2026, 6, 29, 22, 2, 21),
      Date.UTC(2026, 6, 29, 22, 3, 31),
      Date.UTC(2026, 6, 29, 22, 4, 41),
    ]

    expect(() => {
      for (const [index, now] of callTimes.entries()) {
        markAgentRequestEphemeralState(target, now)
        if (index === 4) throw new Error('fifth call failed')
      }
    }).toThrow('fifth call failed')

    const fifth = callTimes[4]!
    expect(target.ephemeralStateExpiresAt).toBe(
      calculateEphemeralStateExpiresAt(
        fifth,
        Math.floor(fifth / 1000) + 60,
      ),
    )
  })

  it('persists crash-safe expiry before all 9 onboarding and 8 agent model actions', async () => {
    const events: string[] = []
    const target = {
      ephemeralStateExpiresAt: 1,
      recordEphemeralStateExpiresAt: vi.fn(
        async (expiresAt: number) => {
          events.push(`persist:${expiresAt}`)
        },
      ),
    }
    const modelActions = [
      ...onboardingGenerationPlan,
      ...agentCallMatrix,
      'legal-positive',
      'legal-negative',
    ]

    for (const [index, action] of modelActions.entries()) {
      const observedAtMs =
        Date.UTC(2026, 6, 29, 22, 0, 1) + index * 70_000
      await persistEphemeralStateBeforeRequest(
        target,
        async () => {
          events.push(`request:${String(action)}`)
        },
        observedAtMs,
      )
    }

    expect(modelActions).toHaveLength(17)
    expect(
      target.recordEphemeralStateExpiresAt,
    ).toHaveBeenCalledTimes(17)
    for (let index = 0; index < modelActions.length; index += 1) {
      expect(events[index * 2]).toMatch(/^persist:\d+$/)
      expect(events[index * 2 + 1]).toBe(
        `request:${String(modelActions[index])}`,
      )
    }
  })

  it('does not start the model action when expiry persistence fails', async () => {
    const action = vi.fn(async () => undefined)
    const target = {
      ephemeralStateExpiresAt: 1,
      recordEphemeralStateExpiresAt: vi.fn(async () => {
        throw new Error('journal write failed')
      }),
    }

    await expect(
      persistEphemeralStateBeforeRequest(
        target,
        action,
        Date.UTC(2026, 6, 29, 22, 0, 1),
      ),
    ).rejects.toThrow('journal write failed')
    expect(action).not.toHaveBeenCalled()
  })

  it('keeps the persisted deadline when the model action fails', async () => {
    const target = {
      ephemeralStateExpiresAt: 1,
      recordEphemeralStateExpiresAt: vi.fn(
        async () => undefined,
      ),
    }
    const observedAtMs = Date.UTC(2026, 6, 29, 22, 0, 1)

    await expect(
      persistEphemeralStateBeforeRequest(
        target,
        async () => {
          throw new Error('model request failed')
        },
        observedAtMs,
      ),
    ).rejects.toThrow('model request failed')
    expect(
      target.recordEphemeralStateExpiresAt,
    ).toHaveBeenCalledWith(target.ephemeralStateExpiresAt)
    expect(target.ephemeralStateExpiresAt).toBe(
      calculateEphemeralStateExpiresAt(
        observedAtMs,
        Math.floor(observedAtMs / 1000) + 60,
      ),
    )
  })

  it('matches only the exact canonical production agent response', () => {
    const input = {
      method: 'POST',
      pathname: '/api/agents/run',
      baseUrl: 'https://akademia-ai-platform.vercel.app',
    } as const

    expect(
      isCanonicalProductionPost({
        ...input,
        url: 'https://akademia-ai-platform.vercel.app/api/agents/run',
      }),
    ).toBe(true)
    expect(
      isCanonicalProductionPost({
        ...input,
        url: 'https://parallel.example/api/agents/run',
      }),
    ).toBe(false)
    expect(
      isCanonicalProductionPost({
        ...input,
        url: 'https://akademia-ai-platform.vercel.app.evil.example/api/agents/run',
      }),
    ).toBe(false)
    expect(
      isCanonicalProductionPost({
        ...input,
        method: 'GET',
        url: 'https://akademia-ai-platform.vercel.app/api/agents/run',
      }),
    ).toBe(false)
    expect(
      isCanonicalProductionPost({
        ...input,
        url: 'https://akademia-ai-platform.vercel.app/api/agents/run?parallel=1',
      }),
    ).toBe(false)
  })

  it('returns the persistent A/B runtime as the Task 9 handoff', () => {
    const contextA = { id: 'context-a' }
    const pageA = { id: 'page-a' }
    const contextB = { id: 'context-b' }
    const pageB = { id: 'page-b' }
    const budget = { id: 'budget' }
    const operatorContext = { id: 'operator' }
    const fixtures = { id: 'fixtures' }
    const modelIds = new Set(['claude-haiku-4-5-20251001'])
    const runScenario = vi.fn()
    const networkLedger = createTask8NetworkLedger()
    const recordEphemeralStateExpiresAt = vi.fn(
      async () => undefined,
    )
    const foreignUserMarkers = buildForeignUserMarkers({
      runId,
      userB:
        `synthetic-release-${runId}-b@example.invalid`,
      userBSubject:
        'c4f5e993-3182-700f-5c34-1662f3a325c7',
    })
    const ephemeralStateExpiresAt = 1_785_363_670

    expect(
      buildTask8BrowserHandoff({
        fixtures,
        contextA,
        pageA,
        contextB,
        pageB,
        budget,
        operatorContext,
        modelIds,
        runScenario,
        networkLedger,
        recordEphemeralStateExpiresAt,
        foreignUserMarkers,
        profileMarker: profileMarkerA,
        ephemeralStateExpiresAt,
        userASubject: 'b3e4d882-2071-700e-4b23-0551e29214b6',
        userBSubject: 'c4f5e993-3182-700f-5c34-1662f3a325c7',
      }),
    ).toEqual({
      fixtures,
      contextA,
      pageA,
      contextB,
      pageB,
      budget,
      operatorContext,
      modelIds,
      runScenario,
      networkLedger,
      recordEphemeralStateExpiresAt,
      foreignUserMarkers,
      profileMarker: profileMarkerA,
      ephemeralStateExpiresAt,
      userASubject: 'b3e4d882-2071-700e-4b23-0551e29214b6',
      userBSubject: 'c4f5e993-3182-700f-5c34-1662f3a325c7',
    })
  })
})
