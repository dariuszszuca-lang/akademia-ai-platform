import { describe, expect, it } from 'vitest'
import { canTransitionSourceJobStatus } from './job-lifecycle'

describe('property source job lifecycle', () => {
  it.each([
    ['queued', 'running'],
    ['queued', 'failed'],
    ['running', 'waiting_external'],
    ['running', 'succeeded'],
    ['running', 'needs_manual_review'],
    ['waiting_external', 'running'],
    ['waiting_external', 'succeeded'],
    ['waiting_external', 'needs_manual_review'],
  ] as const)('allows %s -> %s', (current, next) => {
    expect(canTransitionSourceJobStatus(current, next)).toBe(true)
  })

  it.each([
    ['queued', 'succeeded'],
    ['queued', 'waiting_external'],
    ['succeeded', 'running'],
    ['failed', 'running'],
    ['needs_manual_review', 'running'],
    ['cancelled', 'queued'],
  ] as const)('rejects %s -> %s', (current, next) => {
    expect(canTransitionSourceJobStatus(current, next)).toBe(false)
  })

  it('treats a repeated status as an idempotent transition', () => {
    expect(canTransitionSourceJobStatus('waiting_external', 'waiting_external'))
      .toBe(true)
  })
})
