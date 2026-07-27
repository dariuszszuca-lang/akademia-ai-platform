import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PropertyFact } from '@/features/properties/domain'
import FactsBoard from './FactsBoard'

describe('FactsBoard', () => {
  it('renders evidence status, visibility and safe JSON content', () => {
    const html = renderToStaticMarkup(
      createElement(FactsBoard, {
        facts: [
          fact({
            id: 'fact-1',
            value: { rooms: 3, note: '<script>alert(1)</script>' },
            valueType: 'json',
            status: 'conflicting',
            visibility: 'internal',
          }),
        ],
      }),
    )

    expect(html).toContain('Konflikt')
    expect(html).toContain('Wewnętrzne')
    expect(html).toContain('Powierzchnie')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })
})

function fact(changes: Partial<PropertyFact>): PropertyFact {
  const now = new Date('2026-07-27T08:00:00.000Z')
  return {
    id: 'fact',
    propertyProjectId: 'project-1',
    key: 'usableArea',
    label: 'Powierzchnia użytkowa',
    category: 'areas',
    valueType: 'number',
    value: 52.4,
    unit: 'm²',
    status: 'declared',
    visibility: 'public',
    sourceIds: [],
    createdByType: 'user',
    createdById: 'user-a',
    confirmedAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...changes,
  }
}
