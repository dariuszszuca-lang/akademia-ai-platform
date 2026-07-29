import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { AI_MODEL_ID_HEADER } from '@/lib/model-id'
import { LEGAL_NO_SOURCE_MESSAGE } from '@/lib/legal/fallback'
import { signLegalNoHitProbe } from '@/features/current-release-acceptance/legal-probe'

const mocks = vi.hoisted(() => ({
  resolveApiUser: vi.fn(),
  findAgent: vi.fn(),
  findTool: vi.fn(),
  getUserContext: vi.fn(),
  searchLegal: vi.fn(),
  getEffectivePlan: vi.fn(),
  rateLimit: vi.fn(),
  anthropicStream: vi.fn(),
}))

vi.mock('@/lib/request-auth', () => ({
  resolveApiUser: mocks.resolveApiUser,
}))

vi.mock('@/data/agents', () => ({
  findAgent: mocks.findAgent,
  findTool: mocks.findTool,
}))

vi.mock('@/lib/agent/user-context', () => ({
  getUserContext: mocks.getUserContext,
  userContextAsBlock: vi.fn(() => 'synthetic user context'),
}))

vi.mock('@/lib/legal/search', () => ({
  searchLegal: mocks.searchLegal,
  formatChunksForPrompt: vi.fn((chunks: unknown[]) =>
    chunks.length > 0
      ? 'synthetic legal chunks'
      : '(brak relewantnych fragmentów ustawowych)',
  ),
}))

vi.mock('@/lib/billing/state', () => ({
  getEffectivePlan: mocks.getEffectivePlan,
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mocks.rateLimit,
  LIMITS: {
    AGENT_RUN: { limit: 30, windowMinutes: 1 },
  },
}))

vi.mock('@/lib/anthropic', () => ({
  anthropic: {
    messages: {
      stream: mocks.anthropicStream,
    },
  },
  DEFAULT_MODEL: 'claude-test-model',
}))

describe('POST /api/agents/run authentication', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveApiUser.mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: 'unauthorized' },
        { status: 401 },
      ),
    })
  })

  it('returns 401 before parsing or invoking downstream dependencies', async () => {
    const request = new Request('https://example.test/api/agents/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'prawny',
        toolId: 'analiza-umowy',
        context: 'synthetic context',
        goal: 'synthetic goal',
      }),
    })
    const json = vi.spyOn(request, 'json')
    const { POST } = await import('./run/route')

    const response = await POST(request)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'unauthorized',
    })
    expect(mocks.resolveApiUser).toHaveBeenCalledOnce()
    expect(json).not.toHaveBeenCalled()
    expect(mocks.findAgent).not.toHaveBeenCalled()
    expect(mocks.findTool).not.toHaveBeenCalled()
    expect(mocks.rateLimit).not.toHaveBeenCalled()
    expect(mocks.getUserContext).not.toHaveBeenCalled()
    expect(mocks.getEffectivePlan).not.toHaveBeenCalled()
    expect(mocks.searchLegal).not.toHaveBeenCalled()
    expect(mocks.anthropicStream).not.toHaveBeenCalled()
  })

  it('exposes the configured safe model on a successful response', async () => {
    mocks.resolveApiUser.mockResolvedValue({
      ok: true,
      userId: 'synthetic-user',
    })
    mocks.findAgent.mockReturnValue({
      id: 'ceo',
      name: 'CEO',
      tagline: 'Synthetic tagline',
      description: 'Synthetic description',
    })
    mocks.findTool.mockReturnValue({
      id: 'plan-tygodnia',
      title: 'Synthetic tool',
      description: 'Synthetic tool description',
    })
    mocks.rateLimit.mockResolvedValue({ ok: true })
    mocks.getUserContext.mockResolvedValue({
      profil: '# synthetic profile',
      personaBuyer: null,
      personaSeller: null,
      hasAny: true,
    })
    mocks.getEffectivePlan.mockResolvedValue({
      plan: 'pro',
      active: true,
    })
    mocks.anthropicStream.mockReturnValue(
      (async function* () {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'synthetic output' },
        }
      })(),
    )
    const request = new Request(
      'https://example.test/api/agents/run',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agentId: 'ceo',
          toolId: 'plan-tygodnia',
          context: 'synthetic context',
          goal: 'synthetic goal',
        }),
      },
    )
    const { POST } = await import('./run/route')

    const response = await POST(request)
    await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get(AI_MODEL_ID_HEADER)).toBe(
      'claude-test-model',
    )
  })

  it('accepts a signed legal no-hit probe, skips retrieval and prefixes the real fallback', async () => {
    const adminPassword = 'Synthetic-admin-password-123!'
    const runId = 'syn-20260729T220000Z-deadbeef'
    const userId = '11111111-1111-4111-8111-111111111111'
    vi.stubEnv('ADMIN_PASSWORD', adminPassword)
    setupSuccessfulAgentDependencies('prawny', userId)
    const signature = signLegalNoHitProbe({
      adminPassword,
      runId,
      userId,
    })
    const request = legalRequest({
      agentId: 'prawny',
      headers: {
        'x-current-release-run-id': runId,
        'x-current-release-legal-no-hit': signature,
      },
    })
    const { POST } = await import('./run/route')

    const response = await POST(request)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get(AI_MODEL_ID_HEADER)).toBe(
      'claude-test-model',
    )
    expect(body.startsWith(`${LEGAL_NO_SOURCE_MESSAGE}\n\n`)).toBe(
      true,
    )
    expect(body).not.toContain('[[META]]')
    expect(body).not.toContain('[Błąd generowania:')
    expect(mocks.searchLegal).not.toHaveBeenCalled()
    expect(mocks.anthropicStream).toHaveBeenCalledOnce()
    expect(mocks.anthropicStream.mock.calls[0]![0].system).toContain(
      LEGAL_NO_SOURCE_MESSAGE,
    )
  })

  it.each([
    {
      label: 'foreign subject',
      agentId: 'prawny',
      buildHeaders: (
        adminPassword: string,
        runId: string,
      ) => ({
        'x-current-release-run-id': runId,
        'x-current-release-legal-no-hit': signLegalNoHitProbe({
          adminPassword,
          runId,
          userId: '22222222-2222-4222-8222-222222222222',
        }),
      }),
    },
    {
      label: 'non-legal agent',
      agentId: 'ceo',
      buildHeaders: (
        adminPassword: string,
        runId: string,
      ) => ({
        'x-current-release-run-id': runId,
        'x-current-release-legal-no-hit': signLegalNoHitProbe({
          adminPassword,
          runId,
          userId: '11111111-1111-4111-8111-111111111111',
        }),
      }),
    },
    {
      label: 'incomplete headers',
      agentId: 'prawny',
      buildHeaders: (_adminPassword: string, runId: string) => ({
        'x-current-release-run-id': runId,
      }),
    },
  ])(
    'rejects $label probe with stable 403 before retrieval or model',
    async ({ agentId, buildHeaders }) => {
      const adminPassword = 'Synthetic-admin-password-123!'
      const runId = 'syn-20260729T220000Z-deadbeef'
      const userId = '11111111-1111-4111-8111-111111111111'
      vi.stubEnv('ADMIN_PASSWORD', adminPassword)
      setupSuccessfulAgentDependencies(agentId, userId)
      const request = legalRequest({
        agentId,
        headers: buildHeaders(adminPassword, runId),
      })
      const { POST } = await import('./run/route')

      const response = await POST(request)

      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toEqual({
        error: 'CURRENT_RELEASE_LEGAL_PROBE_FORBIDDEN',
      })
      expect(mocks.rateLimit).not.toHaveBeenCalled()
      expect(mocks.getUserContext).not.toHaveBeenCalled()
      expect(mocks.getEffectivePlan).not.toHaveBeenCalled()
      expect(mocks.searchLegal).not.toHaveBeenCalled()
      expect(mocks.anthropicStream).not.toHaveBeenCalled()
    },
  )

  it('keeps normal legal requests on the retrieval path', async () => {
    const userId = '11111111-1111-4111-8111-111111111111'
    setupSuccessfulAgentDependencies('prawny', userId)
    mocks.searchLegal.mockResolvedValue([
      {
        id: 'synthetic-source',
        text: 'Synthetic legal excerpt',
        ustawa: 'Synthetic act',
        art_number: '158',
        score: 0.9,
      },
    ])
    const { POST } = await import('./run/route')

    const response = await POST(
      legalRequest({ agentId: 'prawny', headers: {} }),
    )
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(mocks.searchLegal).toHaveBeenCalledOnce()
    expect(body).toContain('[[META]]')
    expect(mocks.anthropicStream).toHaveBeenCalledOnce()
  })
})

function setupSuccessfulAgentDependencies(
  agentId: string,
  userId: string,
): void {
  mocks.resolveApiUser.mockResolvedValue({ ok: true, userId })
  mocks.findAgent.mockReturnValue({
    id: agentId,
    name: agentId === 'prawny' ? 'Prawny' : 'CEO',
    tagline: 'Synthetic tagline',
    description: 'Synthetic description',
  })
  mocks.findTool.mockReturnValue({
    id: 'synthetic-tool',
    title: 'Synthetic tool',
    description: 'Synthetic tool description',
  })
  mocks.rateLimit.mockResolvedValue({ ok: true })
  mocks.getUserContext.mockResolvedValue({
    profil: '# synthetic profile',
    personaBuyer: null,
    personaSeller: null,
    hasAny: true,
  })
  mocks.getEffectivePlan.mockResolvedValue({
    plan: 'pro',
    active: true,
  })
  mocks.anthropicStream.mockImplementation(() =>
    (async function* () {
      yield {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'synthetic output' },
      }
    })(),
  )
}

function legalRequest(input: {
  agentId: string
  headers: Record<string, string>
}): Request {
  return new Request('https://example.test/api/agents/run', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...input.headers,
    },
    body: JSON.stringify({
      agentId: input.agentId,
      toolId: 'synthetic-tool',
      context: 'synthetic legal context',
      goal: 'synthetic legal goal',
    }),
  })
}
