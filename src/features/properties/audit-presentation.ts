import {
  propertyFactStatuses,
  propertyStages,
  type PropertyFactStatus,
  type PropertyStage,
} from './domain'
import {
  getFactCategoryLabel,
  getFactStatusPresentation,
  getPropertyStageLabel,
} from './presentation'
import type { AuditRecord } from './repository'

const actionLabels = {
  'property.created': 'Utworzono teczkę',
  'property.updated': 'Zmieniono teczkę',
  'fact.created': 'Dodano fakt',
  'fact.updated': 'Zmieniono fakt',
  'source.registered': 'Zarejestrowano źródło',
  'proposal.created': 'AI przygotowało propozycję',
  'proposal.decided': 'Rozstrzygnięto propozycję',
} as const

const actorLabels: Record<AuditRecord['actorType'], string> = {
  user: 'Użytkownik',
  ai: 'AI',
  integration: 'Integracja',
}

const factStatusSet = new Set<string>(propertyFactStatuses)
const propertyStageSet = new Set<string>(propertyStages)

export type PresentedAuditRecord = {
  id: string
  label: string
  actorLabel: string
  entityType: string
  entityId: string
  change: string | null
  createdAt: string
}

export function presentAuditRecord(
  record: AuditRecord,
): PresentedAuditRecord {
  const label =
    actionLabels[record.action as keyof typeof actionLabels] ??
    'Zdarzenie systemowe'
  const isKnownAction = record.action in actionLabels

  return {
    id: record.id,
    label,
    actorLabel: actorLabels[record.actorType],
    entityType: normalizeEntityType(record.entityType),
    entityId: record.entityId,
    change: isKnownAction
      ? describeSafeChange(record.before, record.after)
      : null,
    createdAt: record.createdAt.toISOString(),
  }
}

function describeSafeChange(
  before: unknown,
  after: unknown,
): string | null {
  const beforeSafe = readSafeFields(before)
  const afterSafe = readSafeFields(after)
  const changes: string[] = []

  if (
    beforeSafe.status !== afterSafe.status &&
    (beforeSafe.status || afterSafe.status)
  ) {
    changes.push(
      describeTransition(
        'Status',
        statusLabel(beforeSafe.status),
        statusLabel(afterSafe.status),
      ),
    )
  }
  if (
    beforeSafe.stage !== afterSafe.stage &&
    (beforeSafe.stage || afterSafe.stage)
  ) {
    changes.push(
      describeTransition(
        'Etap',
        stageLabel(beforeSafe.stage),
        stageLabel(afterSafe.stage),
      ),
    )
  }
  if (
    beforeSafe.category !== afterSafe.category &&
    (beforeSafe.category || afterSafe.category)
  ) {
    changes.push(
      describeTransition(
        'Kategoria',
        beforeSafe.category
          ? getFactCategoryLabel(beforeSafe.category)
          : null,
        afterSafe.category
          ? getFactCategoryLabel(afterSafe.category)
          : null,
      ),
    )
  }

  return changes.length > 0 ? changes.join(' · ') : null
}

function readSafeFields(value: unknown): {
  status: PropertyFactStatus | null
  stage: PropertyStage | null
  category: string | null
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { status: null, stage: null, category: null }
  }
  const input = value as Record<string, unknown>
  return {
    status:
      typeof input.status === 'string' &&
      factStatusSet.has(input.status)
        ? (input.status as PropertyFactStatus)
        : null,
    stage:
      typeof input.stage === 'string' &&
      propertyStageSet.has(input.stage)
        ? (input.stage as PropertyStage)
        : null,
    category:
      typeof input.category === 'string' &&
      /^[a-z][a-zA-Z0-9._-]{0,79}$/.test(input.category)
        ? input.category
        : null,
  }
}

function statusLabel(status: PropertyFactStatus | null): string | null {
  return status ? getFactStatusPresentation(status).label : null
}

function stageLabel(stage: PropertyStage | null): string | null {
  return stage ? getPropertyStageLabel(stage) : null
}

function describeTransition(
  field: string,
  before: string | null,
  after: string | null,
): string {
  if (before && after) return `${field}: ${before} → ${after}`
  return `${field}: ${after ?? before ?? 'Brak'}`
}

function normalizeEntityType(entityType: string): string {
  return [
    'property_project',
    'property_fact',
    'property_source',
    'property_fact_proposal',
  ].includes(entityType)
    ? entityType
    : 'system'
}
