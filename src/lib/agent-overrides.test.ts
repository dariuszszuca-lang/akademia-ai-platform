import { describe, expect, it } from 'vitest'
import { applyAgentOverrides } from './agent-overrides'

describe('agent overrides', () => {
  it('changes only the matching agent flag', () => {
    const input = [
      { id: 'ceo', enabled: true },
      { id: 'marketing', enabled: true },
    ]

    expect(
      applyAgentOverrides(input, {
        'agent:marketing': { enabled: false },
      }),
    ).toEqual([
      { id: 'ceo', enabled: true },
      { id: 'marketing', enabled: false },
    ])
  })
})
