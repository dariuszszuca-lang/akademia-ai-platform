import { describe, expect, it } from 'vitest'
import { resolveFactDefinition } from './catalog'

describe('property extraction fact catalog', () => {
  it.each([
    ['price.asking', 'apartment'],
    ['area.usable', 'house'],
    ['rooms.count', 'apartment'],
    ['legal.landRegisterNumber', 'commercial'],
    ['plot.area', 'plot'],
  ] as const)('resolves %s for %s', (key, propertyType) => {
    expect(resolveFactDefinition(key, propertyType)).not.toBeNull()
  })

  it('limits plot-specific facts to plot and house projects', () => {
    expect(resolveFactDefinition('plot.area', 'plot')).toMatchObject({
      label: 'Powierzchnia działki',
      category: 'Działka',
      valueType: 'number',
      unit: 'm²',
    })
    expect(resolveFactDefinition('plot.area', 'apartment')).toBeNull()
  })

  it('rejects keys outside the trusted catalog', () => {
    expect(resolveFactDefinition('made.up.key', 'house')).toBeNull()
  })

  it('returns immutable trusted metadata', () => {
    const definition = resolveFactDefinition('price.asking', 'apartment')

    expect(definition).toEqual({
      key: 'price.asking',
      label: 'Cena ofertowa',
      category: 'Cena',
      valueType: 'money',
      unit: 'PLN',
      propertyTypes: [
        'apartment',
        'house',
        'plot',
        'commercial',
        'premises',
        'other',
      ],
    })
  })
})
