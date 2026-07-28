import { describe, expect, it } from 'vitest'
import type { AuditRecord } from './repository'
import { presentAuditRecord } from './audit-presentation'

const baseRecord: AuditRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  propertyProjectId: '33333333-3333-4333-8333-333333333333',
  actorType: 'user',
  actorId: 'private-user-id',
  action: 'fact.updated',
  entityType: 'property_fact',
  entityId: '44444444-4444-4444-8444-444444444444',
  before: null,
  after: null,
  createdAt: new Date('2026-07-28T20:00:00.000Z'),
}

describe('presentAuditRecord', () => {
  it('describes safe status changes without copying fact values or actor ids', () => {
    const item = presentAuditRecord({
      ...baseRecord,
      before: {
        value: 'tajna pełna wartość',
        status: 'declared',
        address: 'Prywatny adres',
      },
      after: {
        value: 'inna tajna wartość',
        status: 'confirmed',
        fileName: 'prywatny.pdf',
      },
    })

    expect(item).toMatchObject({
      label: 'Zmieniono fakt',
      actorLabel: 'Użytkownik',
      change: 'Status: Z deklaracji → Potwierdzone',
      entityType: 'property_fact',
      entityId: baseRecord.entityId,
    })
    expect(JSON.stringify(item)).not.toContain('tajna pełna wartość')
    expect(JSON.stringify(item)).not.toContain('inna tajna wartość')
    expect(JSON.stringify(item)).not.toContain('Prywatny adres')
    expect(JSON.stringify(item)).not.toContain('prywatny.pdf')
    expect(JSON.stringify(item)).not.toContain('private-user-id')
  })

  it('uses safe labels for stage and category changes', () => {
    expect(
      presentAuditRecord({
        ...baseRecord,
        action: 'property.updated',
        entityType: 'property_project',
        before: { stage: 'draft' },
        after: { stage: 'ready' },
      }).change,
    ).toBe('Etap: Szkic → Gotowe')

    expect(
      presentAuditRecord({
        ...baseRecord,
        before: { category: 'areas' },
        after: { category: 'legal' },
      }).change,
    ).toBe('Kategoria: Powierzchnie → Stan prawny')
  })

  it('redacts before and after for an unknown action', () => {
    const item = presentAuditRecord({
      ...baseRecord,
      action: 'unknown.external.event',
      before: { status: 'declared', token: 'not-safe' },
      after: { status: 'confirmed', evidenceText: 'not-safe' },
    })

    expect(item).toMatchObject({
      label: 'Zdarzenie systemowe',
      change: null,
    })
    expect(JSON.stringify(item)).not.toContain('not-safe')
    expect(JSON.stringify(item)).not.toContain('declared')
    expect(JSON.stringify(item)).not.toContain('confirmed')
  })
})
