import { describe, expect, it } from 'vitest'
import {
  coerceFactValue,
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

  it('coerces typed form values before sending them to the API', () => {
    expect(coerceFactValue('52,4', 'number')).toBe(52.4)
    expect(coerceFactValue('true', 'boolean')).toBe(true)
    expect(coerceFactValue('2026-07-27', 'date')).toBe('2026-07-27')
  })
})
