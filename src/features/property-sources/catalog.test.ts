import { describe, expect, it } from 'vitest'
import {
  normalizeFactLabel,
  propertyFactCatalog,
  resolveFactDefinition,
  resolveFactDefinitionByLabel,
} from './catalog'

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

  it('resolves the usable-area label to its canonical definition', () => {
    expect(resolveFactDefinitionByLabel('Powierzchnia użytkowa')).toMatchObject({
      key: 'area.usable',
    })
  })

  it('normalizes whitespace, case and diacritics when resolving labels', () => {
    expect(
      resolveFactDefinitionByLabel('  POWIERZCHNIA UZYTKOWA  '),
    ).toMatchObject({
      key: 'area.usable',
    })
  })

  it('resolves the asking-price label to its canonical definition', () => {
    expect(resolveFactDefinitionByLabel('Cena ofertowa')).toMatchObject({
      key: 'price.asking',
    })
  })

  it('does not resolve partial labels', () => {
    expect(resolveFactDefinitionByLabel('Powierzchnia')).toBeNull()
  })

  it.each([
    'Cena ofertowa.',
    'Cena-ofertowa',
    'Cena___ofertowa',
    'Cena / ofertowa',
  ])('normalizes punctuation and separator runs in %s', (label) => {
    expect(resolveFactDefinitionByLabel(label)).toMatchObject({
      key: 'price.asking',
    })
  })

  it('normalizes canonically equivalent NFC and NFD labels', () => {
    const label = 'Powierzchnia użytkowa'

    expect(
      resolveFactDefinitionByLabel(label.normalize('NFC')),
    ).toMatchObject({ key: 'area.usable' })
    expect(
      resolveFactDefinitionByLabel(label.normalize('NFD')),
    ).toMatchObject({ key: 'area.usable' })
  })

  it('keeps every normalized catalog label unique', () => {
    const normalizedLabels = propertyFactCatalog.map((definition) =>
      normalizeFactLabel(definition.label),
    )

    expect(new Set(normalizedLabels).size).toBe(normalizedLabels.length)
  })
})
