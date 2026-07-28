import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PresentedAuditRecord } from '@/features/properties/audit-presentation'
import PropertyHistory from './PropertyHistory'

const propertyId = '22222222-2222-4222-8222-222222222222'

const entries: PresentedAuditRecord[] = [
  {
    id: 'audit-one',
    label: 'Zmieniono fakt',
    actorLabel: 'Użytkownik',
    entityType: 'property_fact',
    entityId: 'fact-one',
    change: 'Status: Z deklaracji → Potwierdzone',
    createdAt: '2026-07-28T20:00:00.000Z',
  },
  {
    id: 'audit-two',
    label: 'AI przygotowało propozycję',
    actorLabel: 'AI',
    entityType: 'property_fact_proposal',
    entityId: 'proposal-one',
    change: null,
    createdAt: '2026-07-27T10:30:00.000Z',
  },
  {
    id: 'audit-three',
    label: 'Zdarzenie systemowe',
    actorLabel: 'Integracja',
    entityType: 'system',
    entityId: 'system-one',
    change: null,
    createdAt: '2026-07-27T09:00:00.000Z',
  },
]

describe('PropertyHistory', () => {
  it('renders a grouped semantic timeline with safe links', () => {
    const html = renderToStaticMarkup(
      <PropertyHistory propertyId={propertyId} entries={entries} />,
    )

    expect(html).toContain('Historia zmian')
    expect(html.match(/<ol/g)).toHaveLength(2)
    expect(html.match(/<time/g)).toHaveLength(3)
    expect(html).toContain('Użytkownik')
    expect(html).toContain('AI')
    expect(html).toContain('Integracja')
    expect(html).toContain(
      `href="/nieruchomosci/${propertyId}?fact=fact-one"`,
    )
    expect(html).toContain(
      `href="/nieruchomosci/${propertyId}/zrodla?proposal=proposal-one"`,
    )
    expect(html.match(/<a /g)).toHaveLength(2)
    expect(html).not.toContain('undefined')
  })

  it('shows an explicit empty state', () => {
    const html = renderToStaticMarkup(
      <PropertyHistory propertyId={propertyId} entries={[]} />,
    )

    expect(html).toContain('Historia jest jeszcze pusta')
    expect(html).toContain(
      'Pierwsze bezpieczne zdarzenie pojawi się tutaj',
    )
  })
})
