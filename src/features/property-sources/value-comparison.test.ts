import { describe, expect, it } from 'vitest'
import { propertyFactValuesEqual } from './value-comparison'

describe('property fact value comparison', () => {
  it('treats objects with different key order as equal', () => {
    expect(
      propertyFactValuesEqual(
        { street: 'Dąbrowskiego', number: 10 },
        { number: 10, street: 'Dąbrowskiego' },
      ),
    ).toBe(true)
  })

  it('preserves array order when comparing values', () => {
    expect(propertyFactValuesEqual(['prąd', 'woda'], ['woda', 'prąd'])).toBe(
      false,
    )
  })

  it('distinguishes number and numeric text', () => {
    expect(propertyFactValuesEqual(83.4, '83.4')).toBe(false)
  })
})
