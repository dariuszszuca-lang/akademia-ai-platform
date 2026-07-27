import type { PropertySourceStatus } from './domain'

const allowedSourceStatusTransitions: Record<
  PropertySourceStatus,
  readonly PropertySourceStatus[]
> = {
  upload_pending: ['uploaded', 'failed', 'deleted'],
  uploaded: ['scanning', 'validating', 'failed', 'deleted'],
  scanning: ['quarantined', 'validating', 'failed', 'deleted'],
  quarantined: ['deleted'],
  validating: ['queued', 'failed', 'deleted'],
  queued: ['processing', 'failed', 'deleted'],
  processing: ['review_ready', 'failed', 'deleted'],
  review_ready: ['completed', 'deleted'],
  completed: ['deleted'],
  failed: ['deleted'],
  deleted: [],
}

export function canTransitionSourceStatus(
  currentStatus: PropertySourceStatus,
  nextStatus: PropertySourceStatus,
): boolean {
  return (
    currentStatus === nextStatus ||
    allowedSourceStatusTransitions[currentStatus].includes(nextStatus)
  )
}
