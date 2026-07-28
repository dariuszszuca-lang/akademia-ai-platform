import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { OpenIssue } from '@/features/properties/open-issues'
import OpenIssuesBoard from './OpenIssuesBoard'

const propertyId = '22222222-2222-4222-8222-222222222222'

const issues: OpenIssue[] = [
  {
    id: 'proposal:one',
    factKey: 'area.usable',
    label: 'Powierzchnia użytkowa',
    category: 'areas',
    kind: 'conflict',
    priority: 1,
    factId: 'fact-one',
    proposalId: 'proposal-one',
    sourceId: 'source-one',
    evidenceLocator: { type: 'page', page: 2 },
    action: 'decide_proposal',
  },
  {
    id: 'proposal:two',
    factKey: 'legal.encumbrances',
    label: 'Obciążenia',
    category: 'legal',
    kind: 'needs_review',
    priority: 2,
    factId: null,
    proposalId: 'proposal-two',
    sourceId: 'source-two',
    evidenceLocator: { type: 'sheet', sheet: 'Dane', row: 3, column: 'C' },
    action: 'open_source',
  },
  {
    id: 'fact:three',
    factKey: 'rooms.count',
    label: 'Liczba pokoi',
    category: 'rooms',
    kind: 'missing',
    priority: 3,
    factId: 'fact-three',
    proposalId: null,
    sourceId: null,
    evidenceLocator: null,
    action: 'complete_fact',
  },
]

describe('OpenIssuesBoard', () => {
  it('renders accessible filters and explicit recovery actions', () => {
    const html = renderToStaticMarkup(
      <OpenIssuesBoard propertyId={propertyId} issues={issues} />,
    )

    expect(html).toContain('Braki i konflikty')
    expect(html).toContain(
      'aria-label="Filtry otwartych kwestii"',
    )
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Rozstrzygnij propozycję')
    expect(html).toContain('Otwórz źródło')
    expect(html).toContain('Uzupełnij fakt')
    expect(html).toContain('Strona 2')
    expect(html).not.toContain('undefined')
  })

  it('shows a helpful empty state', () => {
    const html = renderToStaticMarkup(
      <OpenIssuesBoard propertyId={propertyId} issues={[]} />,
    )

    expect(html).toContain('Brak otwartych kwestii')
    expect(html).toContain('Teczka nie wymaga teraz wyjaśnień')
  })
})
