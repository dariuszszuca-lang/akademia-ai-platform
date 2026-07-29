import { beforeEach, describe, expect, it, vi } from 'vitest'

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
}))

vi.mock('@/lib/legal/search', () => ({
  searchLegal: mocks.searchLegal,
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
  DEFAULT_MODEL: 'test-model',
}))

describe('POST /api/agents/run authentication', () => {
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
})
