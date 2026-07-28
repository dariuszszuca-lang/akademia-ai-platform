import { describe, expect, it } from 'vitest'
import { assertExpectedSyntheticSourceOutcome } from './production-dependencies'

describe('production synthetic source outcome contract', () => {
  it('accepts evidence-free sources only as explicit manual review', () => {
    expect(() =>
      assertExpectedSyntheticSourceOutcome('needs_manual_review', {
        status: 'review_ready',
        errorCode: 'NO_EVIDENCE',
      }),
    ).not.toThrow()

    expect(() =>
      assertExpectedSyntheticSourceOutcome('needs_manual_review', {
        status: 'review_ready',
        errorCode: null,
      }),
    ).toThrow('SYNTHETIC_MANUAL_REVIEW_MISSING')
  })

  it('accepts only ready terminal states for ordinary materials', () => {
    expect(() =>
      assertExpectedSyntheticSourceOutcome('review_ready', {
        status: 'review_ready',
        errorCode: null,
      }),
    ).not.toThrow()

    expect(() =>
      assertExpectedSyntheticSourceOutcome('review_ready', {
        status: 'failed',
        errorCode: 'EXTRACTION_FAILED',
      }),
    ).toThrow('SYNTHETIC_SOURCE_NOT_REVIEW_READY')
  })
})
