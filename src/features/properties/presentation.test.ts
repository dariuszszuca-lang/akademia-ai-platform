import { describe, expect, it } from 'vitest'
import {
  formatFactValue,
  getFactStatusPresentation,
  getPropertyStageLabel,
  getUnresolvedFacts,
} from './presentation'
import type { PropertyFact } from './domain'

describe('property presentation', () => {
  it('uses a label and symbol for every fact status', () => {
    expect(getFactStatusPresentation('confirmed')).toMatchObject({
      label: 'Potwierdzone',
      symbol: '✓',
    })
    expect(getFactStatusPresentation('conflicting')).toMatchObject({
      label: 'Konflikt',
      symbol: '!',
    })
  })

  it('formats values without interpreting their meaning', () => {
    expect(formatFactValue(52.4, 'number', 'm²')).toBe('52,4 m²')
    expect(formatFactValue(680000, 'money', 'PLN')).toBe('680 000 PLN')
    expect(formatFactValue({ mpzp: true }, 'json')).toBe(
      '{\n  "mpzp": true\n}',
    )
  })

  it('selects only missing and conflicting facts', () => {
    const facts = [
      fact({ id: '1', status: 'missing' }),
      fact({ id: '2', status: 'conflicting' }),
      fact({ id: '3', status: 'declared' }),
    ]

    expect(getUnresolvedFacts(facts).map((item) => item.id)).toEqual(['1', '2'])
  })

  it('translates property stages into operational Polish labels', () => {
    expect(getPropertyStageLabel('verification')).toBe('Weryfikacja')
    expect(getPropertyStageLabel('under_offer')).toBe('W negocjacjach')
  })
})

function fact(
  changes: Partial<PropertyFact> & Pick<PropertyFact, 'id' | 'status'>,
): PropertyFact {
  const now = new Date('2026-07-27T08:00:00.000Z')
  const { id, status, ...otherChanges } = changes
  return {
    id,
    propertyProjectId: 'project-1',
    key: 'usableArea',
    label: 'Powierzchnia użytkowa',
    category: 'areas',
    valueType: 'number',
    value: 52.4,
    unit: 'm²',
    status,
    visibility: 'public',
    sourceIds: [],
    createdByType: 'user',
    createdById: 'user-a',
    confirmedAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...otherChanges,
  }
}
