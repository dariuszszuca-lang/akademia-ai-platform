import { describe, expect, it } from 'vitest'
import { calculateHaiku45CostMicrounits } from './provider-cost'

describe('Claude Haiku 4.5 Bedrock cost telemetry', () => {
  it('calculates one USD microunit per input token and five per output token', () => {
    expect(
      calculateHaiku45CostMicrounits({
        inputTokens: 1200,
        outputTokens: 300,
      }),
    ).toBe(2700)
  })

  it('rejects negative, fractional or unsafe token counts', () => {
    expect(() =>
      calculateHaiku45CostMicrounits({
        inputTokens: -1,
        outputTokens: 0,
      }),
    ).toThrow('INVALID_TOKEN_COUNT')
    expect(() =>
      calculateHaiku45CostMicrounits({
        inputTokens: 1.5,
        outputTokens: 0,
      }),
    ).toThrow('INVALID_TOKEN_COUNT')
  })
})
