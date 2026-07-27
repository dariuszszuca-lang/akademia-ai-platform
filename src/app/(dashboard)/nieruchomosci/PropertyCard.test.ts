import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PropertyCard from './PropertyCard'

describe('PropertyCard', () => {
  it('shows portfolio context without exposing the exact address', () => {
    const html = renderToStaticMarkup(
      createElement(PropertyCard, {
        project: {
          id: 'property-1',
          organizationId: 'org-1',
          createdByUserId: 'user-a',
          title: 'Apartament przy parku',
          propertyType: 'apartment',
          transactionType: 'sale',
          stage: 'verification',
          city: 'Poznań',
          district: 'Jeżyce',
          addressMode: 'exact',
          address: 'ul. Poufna 12/4',
          createdAt: new Date('2026-07-20T08:00:00.000Z'),
          updatedAt: new Date('2026-07-27T08:00:00.000Z'),
          archivedAt: null,
        },
      }),
    )

    expect(html).toContain('Apartament przy parku')
    expect(html).toContain('Poznań')
    expect(html).toContain('Jeżyce')
    expect(html).toContain('Weryfikacja')
    expect(html).not.toContain('Poufna')
  })
})
