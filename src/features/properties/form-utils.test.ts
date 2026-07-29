import { describe, expect, it } from 'vitest'
import {
  coerceFactValue,
  resolveFactInput,
  resolveFactKey,
  toFactKey,
} from './form-utils'

describe('property fact form utilities', () => {
  it('creates a stable technical key from a Polish label', () => {
    expect(toFactKey('Powierzchnia użytkowa')).toBe('powierzchniaUzytkowa')
    expect(toFactKey('  Cena ofertowa  ')).toBe('cenaOfertowa')
  })

  it('uses the canonical catalog key for a known label', () => {
    expect(resolveFactKey('Powierzchnia użytkowa')).toBe('area.usable')
  })

  it('keeps the generic key fallback for a custom label', () => {
    expect(resolveFactKey('Niestandardowy parametr')).toBe(
      'niestandardowyParametr',
    )
  })

  it('resolves the complete catalog metadata for the property type', () => {
    expect(
      resolveFactInput('Powierzchnia użytkowa', 'apartment', {
        category: 'other',
        valueType: 'text',
        unit: 'cm',
      }),
    ).toEqual({
      key: 'area.usable',
      category: 'Powierzchnia',
      valueType: 'number',
      unit: 'm²',
    })
  })

  it('rejects a known label unsupported by the property type', () => {
    expect(
      resolveFactInput('Powierzchnia działki', 'apartment', {
        category: 'other',
        valueType: 'text',
      }),
    ).toBeNull()
  })

  it('uses manual metadata only for a custom label', () => {
    expect(
      resolveFactInput('Niestandardowy parametr', 'apartment', {
        category: 'other',
        valueType: 'text',
        unit: 'opis',
      }),
    ).toEqual({
      key: 'niestandardowyParametr',
      category: 'other',
      valueType: 'text',
      unit: 'opis',
    })
  })

  it('coerces typed form values before sending them to the API', () => {
    expect(coerceFactValue('52,4', 'number')).toBe(52.4)
    expect(coerceFactValue('true', 'boolean')).toBe(true)
    expect(coerceFactValue('2026-07-27', 'date')).toBe('2026-07-27')
  })
})
