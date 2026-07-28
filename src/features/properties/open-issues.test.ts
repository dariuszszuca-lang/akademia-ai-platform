import { describe, expect, it } from 'vitest'
import type { PropertyFact } from './domain'
import type {
  PropertyFactProposal,
  PropertySource,
} from '../property-sources/domain'
import { buildOpenIssues } from './open-issues'

const organizationId = '11111111-1111-4111-8111-111111111111'
const propertyProjectId = '22222222-2222-4222-8222-222222222222'
const now = new Date('2026-07-28T20:00:00.000Z')

function fact(
  overrides: Partial<PropertyFact> = {},
): PropertyFact {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    propertyProjectId,
    key: 'area.usable',
    label: 'Powierzchnia użytkowa',
    category: 'areas',
    valueType: 'number',
    value: null,
    status: 'missing',
    visibility: 'internal',
    sourceIds: [],
    version: 1,
    createdByType: 'user',
    createdById: 'user-a',
    confirmedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function source(
  id: string,
  fileName: string,
): PropertySource {
  return {
    id,
    organizationId,
    propertyProjectId,
    storageKey: `organizations/${organizationId}/${id}`,
    fileName,
    mediaType: 'application/pdf',
    sizeBytes: 1024,
    checksumSha256: 'ab'.repeat(32),
    status: 'review_ready',
    errorCode: null,
    errorMessage: null,
    uploadedAt: now,
    processedAt: now,
    createdByUserId: 'user-a',
    createdAt: now,
    updatedAt: now,
  }
}

function proposal(
  overrides: Partial<PropertyFactProposal> = {},
): PropertyFactProposal {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    organizationId,
    propertyProjectId,
    sourceId: '44444444-4444-4444-8444-444444444444',
    jobId: '77777777-7777-4777-8777-777777777777',
    externalKey: 'proposal-area',
    factKey: 'area.usable',
    label: 'Powierzchnia użytkowa',
    category: 'areas',
    valueType: 'number',
    value: 82.4,
    unit: 'm²',
    confidence: 0.91,
    evidenceText: 'Tekst dowodu, który nie może trafić do projekcji.',
    evidenceLocator: { type: 'page', page: 2 },
    status: 'conflict',
    conflictsWithFactId:
      '33333333-3333-4333-8333-333333333333',
    decidedByUserId: null,
    decisionNote: null,
    decision: null,
    decisionFingerprint: null,
    decidedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('buildOpenIssues', () => {
  it('deduplicates by fact key and prioritizes proposals over unresolved facts', () => {
    const sourceA = source(
      '44444444-4444-4444-8444-444444444444',
      'tajna-nazwa-operatu.pdf',
    )
    const sourceB = source(
      '55555555-5555-4555-8555-555555555555',
      'prywatna-notatka.pdf',
    )
    const issues = buildOpenIssues({
      facts: [
        fact(),
        fact({
          id: '88888888-8888-4888-8888-888888888888',
          key: 'rooms.count',
          label: 'Liczba pokoi',
          category: 'rooms',
          status: 'missing',
        }),
        fact({ status: 'conflicting' }),
      ],
      proposals: [
        proposal(),
        proposal({
          id: '99999999-9999-4999-8999-999999999999',
          sourceId: sourceB.id,
          externalKey: 'proposal-legal',
          factKey: 'legal.encumbrances',
          label: 'Obciążenia',
          category: 'legal',
          valueType: 'json',
          value: [],
          status: 'needs_review',
          conflictsWithFactId: null,
        }),
      ],
      sources: [sourceA, sourceB],
    })

    expect(issues.map((issue) => issue.kind)).toEqual([
      'conflict',
      'needs_review',
      'missing',
    ])
    expect(
      issues.filter((issue) => issue.factKey === 'area.usable'),
    ).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      proposalId: '66666666-6666-4666-8666-666666666666',
      factId: '33333333-3333-4333-8333-333333333333',
      sourceId: sourceA.id,
      action: 'decide_proposal',
    })
    expect(issues[1]).toMatchObject({
      action: 'open_source',
      sourceId: sourceB.id,
    })
    expect(JSON.stringify(issues)).not.toContain(sourceA.fileName)
    expect(JSON.stringify(issues)).not.toContain('Tekst dowodu')
  })
})
