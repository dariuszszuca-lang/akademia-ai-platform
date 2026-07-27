import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type {
  PropertyFactProposalWire,
  PropertySourceWire,
} from '@/features/property-sources/client'
import PropertySourceDesk from './PropertySourceDesk'

const propertyId = '22222222-2222-4222-8222-222222222222'
const sourceId = '33333333-3333-4333-8333-333333333333'

const source: PropertySourceWire = {
  id: sourceId,
  organizationId: '11111111-1111-4111-8111-111111111111',
  propertyProjectId: propertyId,
  storageKey: `originals/source/${sourceId}`,
  fileName: 'operat szacunkowy.pdf',
  mediaType: 'application/pdf',
  sizeBytes: 1_024_000,
  checksumSha256: 'ab'.repeat(32),
  status: 'review_ready',
  errorCode: null,
  errorMessage: null,
  uploadedAt: '2026-07-27T12:01:00.000Z',
  processedAt: '2026-07-27T12:02:00.000Z',
  createdByUserId: 'user-1',
  createdAt: '2026-07-27T12:00:00.000Z',
  updatedAt: '2026-07-27T12:02:00.000Z',
}

function createProposal(
  overrides: Partial<PropertyFactProposalWire> = {},
): PropertyFactProposalWire {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    organizationId: source.organizationId,
    propertyProjectId: propertyId,
    sourceId,
    jobId: '55555555-5555-4555-8555-555555555555',
    externalKey: 'proposal-1',
    factKey: 'area.usable',
    label: 'Powierzchnia użytkowa',
    category: 'Powierzchnie',
    valueType: 'number',
    value: 82.4,
    unit: 'm²',
    confidence: 0.96,
    evidenceText: 'Powierzchnia użytkowa budynku wynosi 82,4 m².',
    evidenceLocator: { type: 'page', page: 2 },
    status: 'pending',
    conflictsWithFactId: null,
    decidedByUserId: null,
    decisionNote: null,
    decision: null,
    decisionFingerprint: null,
    decidedAt: null,
    createdAt: '2026-07-27T12:02:00.000Z',
    updatedAt: '2026-07-27T12:02:00.000Z',
    ...overrides,
  }
}

describe('PropertySourceDesk', () => {
  it('guides the first upload without implying automatic approval', () => {
    const html = renderToStaticMarkup(
      <PropertySourceDesk
        propertyId={propertyId}
        initialSources={[]}
        initialProposals={[]}
      />,
    )

    expect(html).toContain('Dodaj pierwsze źródło')
    expect(html).toContain(
      'PDF, zdjęcie, DOCX, XLSX, CSV, tekst lub nagranie',
    )
    expect(html).toContain(
      'AI niczego nie zatwierdzi bez Twojej decyzji',
    )
  })

  it('shows source status, evidence and pending human actions', () => {
    const html = renderToStaticMarkup(
      <PropertySourceDesk
        propertyId={propertyId}
        initialSources={[source]}
        initialProposals={[createProposal()]}
      />,
    )

    expect(html).toContain('operat szacunkowy.pdf')
    expect(html).toContain('Do weryfikacji')
    expect(html).toContain('Powierzchnia użytkowa')
    expect(html).toContain('Strona 2')
    expect(html).toContain('Zatwierdź')
    expect(html).toContain('Popraw')
    expect(html).toContain('Odrzuć')
  })

  it('shows explicit conflict decisions', () => {
    const html = renderToStaticMarkup(
      <PropertySourceDesk
        propertyId={propertyId}
        initialSources={[source]}
        initialProposals={[
          createProposal({
            status: 'conflict',
            conflictsWithFactId:
              '66666666-6666-4666-8666-666666666666',
          }),
        ]}
      />,
    )

    expect(html).toContain('Zachowaj obecną')
    expect(html).toContain('Przyjmij nową')
    expect(html).toContain('Zostaw konflikt')
  })
})
