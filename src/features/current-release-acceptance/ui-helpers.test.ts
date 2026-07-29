import { describe, expect, it, vi } from 'vitest'
import {
  assertLegalNegativeSummary,
  assertLegalPositiveSummary,
  buildTask8BrowserHandoff,
  collectObservableModelId,
  createScenarioRunner,
  summarizeAgentBody,
  syntheticAnswer,
  task8BrowserScenarios,
} from '../../../e2e/current-release/ui-helpers'
import { onboardingGenerationPlan } from '../../../e2e/current-release/scenarios/auth-onboarding'
import { agentCallMatrix } from '../../../e2e/current-release/scenarios/agents'

const runId = 'syn-20260729T220000Z-deadbeef'

describe('current release UI helpers', () => {
  it('builds deterministic answers with an actor-specific run marker', () => {
    expect(syntheticAnswer(runId, 0, 'a')).toBe(
      `Syntetyczna odpowiedź A-1; znacznik ${runId}; rynek Testowo.`,
    )
    expect(syntheticAnswer(runId, 0, 'b')).toBe(
      `Syntetyczna odpowiedź B-1; znacznik ${runId}; rynek Testowo.`,
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
        'Bezpieczna odpowiedź dla SYN-A-deadbeef',
        'SYN-B-deadbeef',
      ),
    ).toEqual({
      nonEmpty: true,
      hasGenerationError: false,
      leaksForeignMarker: false,
    })
    expect(
      summarizeAgentBody(
        '[Błąd generowania: provider failed] SYN-B-deadbeef',
        'SYN-B-deadbeef',
      ),
    ).toEqual({
      nonEmpty: true,
      hasGenerationError: true,
      leaksForeignMarker: true,
    })
  })

  it('summarizes positive legal metadata and article evidence', () => {
    const summary = assertLegalPositiveSummary(
      '[[META]]{"sources":[{"id":"s1","ustawa":"Kodeks cywilny","art":"158","ksiega":"","url":"","score":0.93}]}[[/META]]\nForma wynika z art. 158.',
      'SYN-B-deadbeef',
    )

    expect(summary).toEqual({
      nonEmpty: true,
      nonEmptySources: true,
      hasArticleSource: true,
      hasArticleInAnswer: true,
      hasGenerationError: false,
      leaksForeignMarker: false,
    })
    expect(Object.keys(summary)).not.toContain('answer')
    expect(Object.keys(summary)).not.toContain('sources')
  })

  it('requires deterministic legal no-hit evidence without metadata', () => {
    expect(
      assertLegalNegativeSummary(
        'W bazie nie znalazłem przepisu wprost odnoszącego się do tego pytania\n\nOdpowiedź.',
        'SYN-B-deadbeef',
      ),
    ).toEqual({
      hasNoSourceMessage: true,
      hasMetadata: false,
      hasGenerationError: false,
      leaksForeignMarker: false,
    })
    expect(() =>
      assertLegalNegativeSummary(
        '[[META]]{"sources":[]}[[/META]]',
        'SYN-B-deadbeef',
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
        userASubject: '11111111-1111-4111-8111-111111111111',
        userBSubject: '22222222-2222-4222-8222-222222222222',
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
      userASubject: '11111111-1111-4111-8111-111111111111',
      userBSubject: '22222222-2222-4222-8222-222222222222',
    })
  })
})
