import { describe, expect, it } from 'vitest'
import { calculateSonnet46CostMicrounits } from './provider-cost'

describe('Claude Sonnet 4.6 Bedrock cost telemetry', () => {
  it('calculates three USD microunits per input token and fifteen per output token', () => {
    expect(
      calculateSonnet46CostMicrounits({
        inputTokens: 1200,
        outputTokens: 300,
      }),
    ).toBe(8100)
  })

  it('rejects negative, fractional or unsafe token counts', () => {
    expect(() =>
      calculateSonnet46CostMicrounits({
        inputTokens: -1,
        outputTokens: 0,
      }),
    ).toThrow('INVALID_TOKEN_COUNT')
    expect(() =>
      calculateSonnet46CostMicrounits({
        inputTokens: 1.5,
        outputTokens: 0,
      }),
    ).toThrow('INVALID_TOKEN_COUNT')
  })
})
