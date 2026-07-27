import type { SourceJobStatus } from './domain'

const allowedSourceJobStatusTransitions: Record<
  SourceJobStatus,
  readonly SourceJobStatus[]
> = {
  queued: ['running', 'failed', 'cancelled'],
  running: [
    'waiting_external',
    'succeeded',
    'failed',
    'needs_manual_review',
    'cancelled',
  ],
  waiting_external: [
    'running',
    'succeeded',
    'failed',
    'needs_manual_review',
    'cancelled',
  ],
  succeeded: [],
  failed: [],
  needs_manual_review: [],
  cancelled: [],
}

export function canTransitionSourceJobStatus(
  currentStatus: SourceJobStatus,
  nextStatus: SourceJobStatus,
): boolean {
  return (
    currentStatus === nextStatus ||
    allowedSourceJobStatusTransitions[currentStatus].includes(nextStatus)
  )
}
