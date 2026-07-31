import { describe, expect, it, vi } from 'vitest'

vi.mock('@playwright/test', () => ({
  expect: () => ({
    toBeEnabled: async () => undefined,
    toBeVisible: async () => undefined,
    toHaveCount: async () => undefined,
  }),
}))

vi.mock('../../../e2e/current-release/operator', () => ({
  confirmUser: async () => undefined,
  createUser: async () => undefined,
  getUserSubject: async (
    _context: unknown,
    email: string,
  ) =>
    email.includes('-a@')
      ? '11111111-1111-4111-8111-111111111111'
      : '22222222-2222-4222-8222-222222222222',
}))

import { runAgentScenarios } from '../../../e2e/current-release/scenarios/agents'
import { runAuthOnboardingScenarios } from '../../../e2e/current-release/scenarios/auth-onboarding'
import { LEGAL_NO_SOURCE_MESSAGE } from '../../lib/legal/fallback'

const runId = 'syn-20260729T220000Z-deadbeef'
const productionOrigin =
  'https://akademia-ai-platform.vercel.app'
const profileMarkerA =
  `PROFILE-A-${runId}-CONTEXT-PROOF`
const profileMarkerB =
  `PROFILE-B-${runId}-CONTEXT-PROOF`
const modelPaths = new Set([
  '/api/onboarding/generate-profil',
  '/api/onboarding/persona/types',
  '/api/onboarding/persona/expand',
  '/api/onboarding/persona/generate',
  '/api/onboarding/generate-deep',
])

type Deferred = {
  promise: Promise<void>
  resolve(): void
  reject(error: Error): void
}

type PersistenceController = {
  gates: Deferred[]
  persisted: number[]
  record(expiresAt: number): Promise<void>
}

type FakeResponse = {
  request(): {
    method(): string
  }
  url(): string
  ok(): boolean
  status(): number
  text(): Promise<string>
  headers(): Record<string, string>
  finished(): Promise<void>
}

type ResponseWaiter = {
  predicate(response: FakeResponse): boolean
  resolve(response: FakeResponse): void
}

type RequestCounter = {
  count: number
  failNextModelAction: boolean
  ignoreProfileContext?: boolean
  leakForeignProfileContext?: boolean
  markerSlipsRemaining?: number
  requestPayloads?: string[]
}

describe('current release scenario TTL call sites', () => {
  it('executes a second real page reload to prove Express wizard resume', async () => {
    const persistence = createPersistenceController(9)
    const requests: RequestCounter = {
      count: 0,
      failNextModelAction: false,
    }
    const browser = new FakeBrowser(requests)
    const execution = runAuthOnboardingScenarios(
      createAuthRuntime(persistence, requests, browser),
    )

    for (const gate of persistence.gates) {
      await waitForCount(
        () => persistence.persisted.length,
        persistence.gates.indexOf(gate) + 1,
      )
      gate.resolve()
    }
    await execution

    expect(browser.pageFor('a').reloadCount).toBe(2)
  })

  it('blocks and then releases each of the 9 real onboarding model actions', async () => {
    const persistence = createPersistenceController(9)
    const requests: RequestCounter = {
      count: 0,
      failNextModelAction: false,
    }
    const execution = runAuthOnboardingScenarios(
      createAuthRuntime(persistence, requests),
    )

    for (let index = 0; index < 9; index += 1) {
      await waitForCount(
        () => persistence.persisted.length,
        index + 1,
      )
      expect(requests.count).toBe(index)
      persistence.gates[index]!.resolve()
      await waitForCount(() => requests.count, index + 1)
    }

    const handoff = await execution
    expect(requests.count).toBe(9)
    expect(persistence.persisted).toHaveLength(9)
    expect(handoff.ephemeralStateExpiresAt).toBe(
      persistence.persisted.at(-1),
    )
  })

  it('starts no onboarding request when persistence rejects', async () => {
    const persistence = createPersistenceController(1)
    const requests: RequestCounter = {
      count: 0,
      failNextModelAction: false,
    }
    const execution = runAuthOnboardingScenarios(
      createAuthRuntime(persistence, requests),
    )
    const rejection = expect(execution).rejects.toThrow(
      'onboarding journal failed',
    )
    await waitForCount(() => persistence.persisted.length, 1)

    persistence.gates[0]!.reject(
      new Error('onboarding journal failed'),
    )

    await rejection
    expect(requests.count).toBe(0)
  })

  it('retains onboarding expiry when the action rejects after persistence', async () => {
    const persistence = createPersistenceController(1)
    const requests: RequestCounter = {
      count: 0,
      failNextModelAction: true,
    }
    const execution = runAuthOnboardingScenarios(
      createAuthRuntime(persistence, requests),
    )
    const rejection = expect(execution).rejects.toThrow(
      'model action failed',
    )
    await waitForCount(() => persistence.persisted.length, 1)
    const persistedDeadline = persistence.persisted[0]

    persistence.gates[0]!.resolve()

    await rejection
    expect(requests.count).toBe(1)
    expect(persistence.persisted).toEqual([
      persistedDeadline,
    ])
  })

  it('blocks and then releases each of the 8 real agent and legal requests', async () => {
    const persistence = createPersistenceController(8)
    const requests: RequestCounter = {
      count: 0,
      failNextModelAction: false,
    }
    const execution = runAgentScenarios(
      createAgentRuntime(persistence, requests),
    )

    for (let index = 0; index < 8; index += 1) {
      await waitForCount(
        () => persistence.persisted.length,
        index + 1,
      )
      expect(requests.count).toBe(index)
      persistence.gates[index]!.resolve()
      await waitForCount(() => requests.count, index + 1)
    }

    await execution
    expect(requests.count).toBe(8)
    expect(persistence.persisted).toHaveLength(8)
    expect(requests.requestPayloads).toHaveLength(8)
    expect(
      requests.requestPayloads?.every(
        (payload) =>
          !payload.includes(profileMarkerA) &&
          !payload.includes(profileMarkerB),
      ),
    ).toBe(true)
  })

  it('fails when the real agent call sites ignore persisted profile and personas', async () => {
    const persistence = createPersistenceController(8)
    persistence.gates.forEach((gate) => gate.resolve())
    const requests: RequestCounter = {
      count: 0,
      failNextModelAction: false,
      ignoreProfileContext: true,
    }

    // One accounted marker retry runs before the failure is fatal.
    await expect(
      runAgentScenarios(
        createAgentRuntime(persistence, requests),
      ),
    ).rejects.toThrow('AGENT_RESPONSE_INVALID')
    expect(requests.count).toBe(2)
    expect(persistence.persisted).toHaveLength(2)
  })

  it('retries a single marker slip as an accounted ninth call', async () => {
    const persistence = createPersistenceController(9)
    persistence.gates.forEach((gate) => gate.resolve())
    const requests: RequestCounter = {
      count: 0,
      failNextModelAction: false,
      markerSlipsRemaining: 1,
    }

    await runAgentScenarios(
      createAgentRuntime(persistence, requests),
    )
    expect(requests.count).toBe(9)
    expect(persistence.persisted).toHaveLength(9)
  })

  it('does not retry the same agent twice on repeated marker slips', async () => {
    const persistence = createPersistenceController(8)
    persistence.gates.forEach((gate) => gate.resolve())
    const requests: RequestCounter = {
      count: 0,
      failNextModelAction: false,
      markerSlipsRemaining: 2,
    }

    await expect(
      runAgentScenarios(
        createAgentRuntime(persistence, requests),
      ),
    ).rejects.toThrow('AGENT_RESPONSE_INVALID_CEO_NO_MARKER')
    expect(requests.count).toBe(2)
    expect(persistence.persisted).toHaveLength(2)
  })

  it('fails when a real agent call leaks the persisted B profile marker', async () => {
    const persistence = createPersistenceController(8)
    persistence.gates.forEach((gate) => gate.resolve())
    const requests: RequestCounter = {
      count: 0,
      failNextModelAction: false,
      leakForeignProfileContext: true,
    }

    await expect(
      runAgentScenarios(
        createAgentRuntime(persistence, requests),
      ),
    ).rejects.toThrow('AGENT_RESPONSE_INVALID')
    expect(requests.count).toBe(1)
    expect(persistence.persisted).toHaveLength(1)
  })

  it('starts no agent request when persistence rejects', async () => {
    const persistence = createPersistenceController(1)
    const requests: RequestCounter = {
      count: 0,
      failNextModelAction: false,
    }
    const execution = runAgentScenarios(
      createAgentRuntime(persistence, requests),
    )
    const rejection = expect(execution).rejects.toThrow(
      'agent journal failed',
    )
    await waitForCount(() => persistence.persisted.length, 1)

    persistence.gates[0]!.reject(
      new Error('agent journal failed'),
    )

    await rejection
    expect(requests.count).toBe(0)
  })

  it('retains agent expiry when the request rejects after persistence', async () => {
    const persistence = createPersistenceController(1)
    const requests: RequestCounter = {
      count: 0,
      failNextModelAction: true,
    }
    const execution = runAgentScenarios(
      createAgentRuntime(persistence, requests),
    )
    const rejection = expect(execution).rejects.toThrow(
      'model action failed',
    )
    await waitForCount(() => persistence.persisted.length, 1)
    const persistedDeadline = persistence.persisted[0]

    persistence.gates[0]!.resolve()

    await rejection
    expect(requests.count).toBe(1)
    expect(persistence.persisted).toEqual([
      persistedDeadline,
    ])
  })
})

function createPersistenceController(
  gateCount: number,
): PersistenceController {
  const gates = Array.from(
    { length: gateCount },
    createDeferred,
  )
  const persisted: number[] = []
  return {
    gates,
    persisted,
    record(expiresAt) {
      const gate = gates[persisted.length]
      if (!gate) {
        return Promise.reject(
          new Error('unexpected persistence call'),
        )
      }
      persisted.push(expiresAt)
      return gate.promise
    },
  }
}

function createDeferred(): Deferred {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function createAuthRuntime(
  persistence: PersistenceController,
  requests: RequestCounter,
  browser = new FakeBrowser(requests),
): Parameters<typeof runAuthOnboardingScenarios>[0] {
  const budget = createFakeBudget()
  const journal = {
    recordUserSubject: async () => undefined,
    recordKvKey: async () => undefined,
    recordEphemeralStateExpiresAt: async () => undefined,
  }
  return {
    browser,
    fixtures: {
      runId,
      baseUrl: productionOrigin,
      userA:
        `synthetic-release-${runId}-a@example.invalid`,
      passwordA: 'Synthetic-password-A-123!',
      userB:
        `synthetic-release-${runId}-b@example.invalid`,
      passwordB: 'Synthetic-password-B-123!',
    },
    operatorContext: {},
    budget,
    journal,
    modelIds: new Set<string>(),
    runScenario: async (
      ...args: [unknown, unknown, () => Promise<void>]
    ) => {
      await args[2]()
    },
    lifecycle: {},
    networkLedger: {
      attach: () => () => undefined,
    },
    recordEphemeralStateExpiresAt: (expiresAt: number) =>
      persistence.record(expiresAt),
  } as unknown as Parameters<
    typeof runAuthOnboardingScenarios
  >[0]
}

function createAgentRuntime(
  persistence: PersistenceController,
  requests: RequestCounter,
): Parameters<typeof runAgentScenarios>[0] {
  return {
    fixtures: {
      runId,
      baseUrl: productionOrigin,
      acceptanceSecret: 'a'.repeat(43),
    },
    pageA: new FakeAgentPage(requests),
    budget: createFakeBudget(9),
    modelIds: new Set<string>(),
    foreignUserMarkers: [profileMarkerB],
    profileMarker: profileMarkerA,
    userASubject: '11111111-1111-4111-8111-111111111111',
    ephemeralStateExpiresAt: 1,
    recordEphemeralStateExpiresAt: (expiresAt: number) =>
      persistence.record(expiresAt),
    runScenario: async (
      ...args: [unknown, unknown, () => Promise<void>]
    ) => {
      await args[2]()
    },
    networkLedger: {
      reconcile: () => ({
        onboardingGenerationCalls: 9,
        agentCalls: 8,
      }),
    },
  } as unknown as Parameters<typeof runAgentScenarios>[0]
}

function createFakeBudget(initialOnboardingCalls = 0) {
  let onboardingGenerationCalls = initialOnboardingCalls
  let agentCalls = 0
  return {
    async runBefore<T>(
      kind: 'onboardingGeneration' | 'agent',
      action: () => Promise<T>,
    ): Promise<T> {
      if (kind === 'onboardingGeneration') {
        onboardingGenerationCalls += 1
      } else {
        agentCalls += 1
      }
      return action()
    },
    snapshot() {
      const reservedUsd =
        onboardingGenerationCalls * 0.06 +
        agentCalls * 0.08
      return {
        onboardingGenerationCalls,
        agentCalls,
        sourcePipelineCalls: 0,
        reservedUsd:
          Math.round(reservedUsd * 1_000_000) / 1_000_000,
      }
    },
  }
}

class FakeBrowser {
  private contextIndex = 0
  private readonly pages = new Map<string, FakePage>()

  constructor(private readonly requests: RequestCounter) {}

  async newContext(): Promise<FakeContext> {
    const role =
      this.contextIndex === 0
        ? 'a'
        : this.contextIndex === 1
          ? 'wrong-password'
          : 'b'
    this.contextIndex += 1
    return new FakeContext(role, this.requests, (page) => {
      this.pages.set(role, page)
    })
  }

  pageFor(role: string): FakePage {
    const page = this.pages.get(role)
    if (!page) throw new Error('fake page missing')
    return page
  }
}

class FakeContext {
  private onboardingReadCount = 0
  readonly request = {
    get: async (pathname: string) => {
      if (
        pathname === '/api/onboarding/state' &&
        this.role === 'a' &&
        this.onboardingReadCount === 0
      ) {
        this.onboardingReadCount += 1
        return fakeApiResponse(401, '')
      }
      return fakeApiResponse(
        200,
        this.role === 'a'
          ? 'Syntetyczna odpowiedź A-1'
          : 'Syntetyczna odpowiedź B-1',
      )
    },
    post: async () => fakeApiResponse(200, ''),
  }

  constructor(
    private readonly role: string,
    private readonly requests: RequestCounter,
    private readonly recordPage: (page: FakePage) => void,
  ) {}

  async newPage(): Promise<FakePage> {
    const page = new FakePage(this.requests, this.role)
    this.recordPage(page)
    return page
  }

  async close(): Promise<void> {}
}

class FakePage {
  private readonly waiters: ResponseWaiter[] = []
  private lastFilledValue = ''
  reloadCount = 0

  constructor(
    private readonly requests: RequestCounter,
    private readonly role: string,
  ) {}

  async goto(): Promise<void> {}

  async reload(): Promise<void> {
    this.reloadCount += 1
  }

  async waitForURL(): Promise<void> {}

  on(): void {}

  getByLabel(): FakeLocator {
    return new FakeLocator(this, 1)
  }

  getByPlaceholder(): FakeLocator {
    return new FakeLocator(this, 1)
  }

  getByRole(): FakeLocator {
    return new FakeLocator(this, 1)
  }

  getByText(): FakeLocator {
    return new FakeLocator(this, 1)
  }

  getByTitle(): FakeLocator {
    return new FakeLocator(this, 1)
  }

  locator(): FakeLocator {
    return new FakeLocator(this, 3)
  }

  waitForResponse(
    predicate: (response: FakeResponse) => boolean,
  ): Promise<FakeResponse> {
    return new Promise((resolve) => {
      this.waiters.push({ predicate, resolve })
    })
  }

  async click(): Promise<void> {
    const waiters = this.waiters.splice(0)
    let startedModelRequest = false
    for (const waiter of waiters) {
      const response = responseCandidates(
        this.role === 'b' ? profileMarkerB : profileMarkerA,
      ).find(
        waiter.predicate,
      )
      if (!response) {
        throw new Error('fake response missing')
      }
      if (modelPaths.has(new URL(response.url()).pathname)) {
        this.requests.count += 1
        startedModelRequest = true
      }
      waiter.resolve(response)
    }
    if (
      startedModelRequest &&
      this.requests.failNextModelAction
    ) {
      this.requests.failNextModelAction = false
      throw new Error('model action failed')
    }
  }

  fill(value: string): void {
    this.lastFilledValue = value
  }

  inputValue(): string {
    return this.lastFilledValue
  }
}

class FakeLocator {
  constructor(
    private readonly page: FakePage,
    private readonly locatorCount: number,
  ) {}

  async click(): Promise<void> {
    await this.page.click()
  }

  async count(): Promise<number> {
    return this.locatorCount
  }

  async fill(value: string): Promise<void> {
    this.page.fill(value)
  }

  async inputValue(): Promise<string> {
    return this.page.inputValue()
  }

  filter(): FakeLocator {
    return this
  }

  first(): FakeLocator {
    return this
  }
}

class FakeAgentPage {
  constructor(private readonly requests: RequestCounter) {}

  waitForResponse(): Promise<FakeResponse> {
    return Promise.resolve(
      fakeBrowserResponse('/api/agents/run', 'POST'),
    )
  }

  async evaluate(
    _callback: unknown,
    input: unknown,
  ): Promise<{
    status: number
    body: string
  }> {
    this.requests.count += 1
    this.requests.requestPayloads ??= []
    this.requests.requestPayloads.push(JSON.stringify(input))
    if (this.requests.failNextModelAction) {
      this.requests.failNextModelAction = false
      throw new Error('model action failed')
    }
    const slippedMarker =
      (this.requests.markerSlipsRemaining ?? 0) > 0
    if (slippedMarker) {
      this.requests.markerSlipsRemaining! -= 1
    }
    const observedProfileMarker =
      this.requests.ignoreProfileContext || slippedMarker
        ? ''
        : `${profileMarkerA}${
            this.requests.leakForeignProfileContext
              ? ` ${profileMarkerB}`
              : ''
          } `
    // Keyed by request content, not call position, so accounted
    // marker retries do not shift the legal probe responses.
    const payload = JSON.stringify(input)
    if (payload.includes('Jaka forma jest wymagana')) {
      return {
        status: 200,
        body:
          `[[META]]{"sources":[{"art":"158"}]}[[/META]]\n${observedProfileMarker}Forma wynika z art. 158.`,
      }
    }
    if (payload.includes('kontrola braku trafienia')) {
      return {
        status: 200,
        body: `${LEGAL_NO_SOURCE_MESSAGE}\n\n${observedProfileMarker}Brak podstawy.`,
      }
    }
    return {
      status: 200,
      body: `${observedProfileMarker}Bezpieczna odpowiedź syntetyczna.`,
    }
  }
}

function responseCandidates(
  profileMarker = profileMarkerA,
): FakeResponse[] {
  const candidates: FakeResponse[] = []
  for (const method of ['POST', 'DELETE']) {
    for (const pathname of [
      '/api/auth/session',
      '/api/onboarding/save-answer',
      '/api/onboarding/generate-profil',
      '/api/onboarding/persona/path',
      '/api/onboarding/persona/types',
      '/api/onboarding/persona/expand',
      '/api/onboarding/persona/answer',
      '/api/onboarding/persona/generate',
      '/api/onboarding/save-deep-answer',
      '/api/onboarding/generate-deep',
    ]) {
      candidates.push(
        fakeBrowserResponse(pathname, method, profileMarker),
      )
    }
  }
  return candidates
}

function fakeBrowserResponse(
  pathname: string,
  method: string,
  profileMarker = profileMarkerA,
): FakeResponse {
  return {
    request: () => ({
      method: () => method,
    }),
    url: () => `${productionOrigin}${pathname}`,
    ok: () => true,
    status: () => 200,
    text: async () =>
      pathname === '/api/onboarding/generate-profil' ||
      pathname === '/api/onboarding/generate-deep'
        ? `# Profil syntetyczny\n\n${profileMarker}`
        : '',
    headers: () => ({
      'x-ai-model-id': 'claude-haiku-4-5-20251001',
    }),
    finished: async () => undefined,
  }
}

function fakeApiResponse(status: number, body: string) {
  return {
    status: () => status,
    text: async () => body,
  }
}

async function waitForCount(
  read: () => number,
  expected: number,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (read() === expected) return
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  }
  expect(read()).toBe(expected)
}
