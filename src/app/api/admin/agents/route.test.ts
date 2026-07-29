import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
  findAgent: vi.fn(),
  getEffectiveAgents: vi.fn(),
  kvStatus: vi.fn(),
  setAgentOverride: vi.fn(),
}))

vi.mock('@/lib/admin-auth', () => ({
  isAuthenticated: mocks.isAuthenticated,
}))

vi.mock('@/data/agents', () => ({
  findAgent: mocks.findAgent,
}))

vi.mock('@/lib/agent-overrides', () => ({
  getEffectiveAgents: mocks.getEffectiveAgents,
  kvStatus: mocks.kvStatus,
  setAgentOverride: mocks.setAgentOverride,
}))

describe('PATCH /api/admin/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isAuthenticated.mockResolvedValue(true)
    mocks.findAgent.mockReturnValue(undefined)
    mocks.setAgentOverride.mockResolvedValue(undefined)
  })

  it('returns 404 without writing an override for an unknown agent', async () => {
    const { PATCH } = await import('./route')
    const request = new Request(
      'https://example.test/api/admin/agents',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: 'unknown-agent',
          enabled: false,
        }),
      },
    )

    const response = await PATCH(request)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Agent not found',
    })
    expect(mocks.findAgent).toHaveBeenCalledWith('unknown-agent')
    expect(mocks.setAgentOverride).not.toHaveBeenCalled()
  })
})
