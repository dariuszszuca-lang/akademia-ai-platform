export const propertyTypes = [
  'apartment',
  'house',
  'plot',
  'commercial',
  'premises',
  'other',
] as const

export const propertyFactValueTypes = [
  'text',
  'number',
  'money',
  'boolean',
  'date',
  'json',
] as const

export type PropertyType = (typeof propertyTypes)[number]
export type PropertyFactValueType = (typeof propertyFactValueTypes)[number]

export type FactDefinition = {
  key: string
  label: string
  category: string
  valueType: PropertyFactValueType
  unit?: string
  propertyTypes: readonly PropertyType[]
}

const allPropertyTypes = propertyTypes
const buildingPropertyTypes = [
  'apartment',
  'house',
  'commercial',
  'premises',
  'other',
] as const
const multiFloorPropertyTypes = [
  'apartment',
  'commercial',
  'premises',
] as const
const plotPropertyTypes = ['plot', 'house'] as const

export const propertyFactCatalog = [
  {
    key: 'price.asking',
    label: 'Cena ofertowa',
    category: 'Cena',
    valueType: 'money',
    unit: 'PLN',
    propertyTypes: allPropertyTypes,
  },
  {
    key: 'price.currency',
    label: 'Waluta ceny',
    category: 'Cena',
    valueType: 'text',
    propertyTypes: allPropertyTypes,
  },
  {
    key: 'area.usable',
    label: 'Powierzchnia użytkowa',
    category: 'Powierzchnia',
    valueType: 'number',
    unit: 'm²',
    propertyTypes: buildingPropertyTypes,
  },
  {
    key: 'area.total',
    label: 'Powierzchnia całkowita',
    category: 'Powierzchnia',
    valueType: 'number',
    unit: 'm²',
    propertyTypes: buildingPropertyTypes,
  },
  {
    key: 'rooms.count',
    label: 'Liczba pokoi',
    category: 'Układ',
    valueType: 'number',
    propertyTypes: buildingPropertyTypes,
  },
  {
    key: 'floor.number',
    label: 'Piętro',
    category: 'Budynek',
    valueType: 'number',
    propertyTypes: multiFloorPropertyTypes,
  },
  {
    key: 'building.floors',
    label: 'Liczba kondygnacji',
    category: 'Budynek',
    valueType: 'number',
    propertyTypes: buildingPropertyTypes,
  },
  {
    key: 'building.yearBuilt',
    label: 'Rok budowy',
    category: 'Budynek',
    valueType: 'number',
    propertyTypes: buildingPropertyTypes,
  },
  {
    key: 'building.type',
    label: 'Rodzaj budynku',
    category: 'Budynek',
    valueType: 'text',
    propertyTypes: buildingPropertyTypes,
  },
  {
    key: 'condition',
    label: 'Stan nieruchomości',
    category: 'Stan',
    valueType: 'text',
    propertyTypes: buildingPropertyTypes,
  },
  {
    key: 'legal.landRegisterNumber',
    label: 'Numer księgi wieczystej',
    category: 'Stan prawny',
    valueType: 'text',
    propertyTypes: allPropertyTypes,
  },
  {
    key: 'legal.ownershipType',
    label: 'Forma własności',
    category: 'Stan prawny',
    valueType: 'text',
    propertyTypes: allPropertyTypes,
  },
  {
    key: 'legal.encumbrances',
    label: 'Obciążenia prawne',
    category: 'Stan prawny',
    valueType: 'json',
    propertyTypes: allPropertyTypes,
  },
  {
    key: 'plot.area',
    label: 'Powierzchnia działki',
    category: 'Działka',
    valueType: 'number',
    unit: 'm²',
    propertyTypes: plotPropertyTypes,
  },
  {
    key: 'plot.identifier',
    label: 'Numer działki',
    category: 'Działka',
    valueType: 'text',
    propertyTypes: plotPropertyTypes,
  },
  {
    key: 'plot.shape',
    label: 'Kształt działki',
    category: 'Działka',
    valueType: 'text',
    propertyTypes: plotPropertyTypes,
  },
  {
    key: 'plot.utilities',
    label: 'Media na działce',
    category: 'Działka',
    valueType: 'json',
    propertyTypes: plotPropertyTypes,
  },
  {
    key: 'plot.accessRoad',
    label: 'Droga dojazdowa',
    category: 'Działka',
    valueType: 'text',
    propertyTypes: plotPropertyTypes,
  },
  {
    key: 'energy.heatingType',
    label: 'Rodzaj ogrzewania',
    category: 'Energia',
    valueType: 'text',
    propertyTypes: buildingPropertyTypes,
  },
  {
    key: 'energy.certificateClass',
    label: 'Klasa energetyczna',
    category: 'Energia',
    valueType: 'text',
    propertyTypes: buildingPropertyTypes,
  },
] as const satisfies readonly FactDefinition[]

export function normalizeFactLabel(label: string): string {
  return label
    .normalize('NFKD')
    .toLocaleLowerCase('pl-PL')
    .replace(/ł/g, 'l')
    .replace(/\p{Mark}+/gu, '')
    .replace(/[\p{Punctuation}\p{Separator}\s]+/gu, ' ')
    .trim()
    .normalize('NFC')
}

export function resolveFactDefinitionByLabel(
  label: string,
): FactDefinition | null {
  const normalizedLabel = normalizeFactLabel(label)
  const definition = propertyFactCatalog.find(
    (candidate) => normalizeFactLabel(candidate.label) === normalizedLabel,
  )

  return definition ?? null
}

export function resolveFactDefinitionByKey(
  key: string,
): FactDefinition | null {
  return (
    propertyFactCatalog.find((candidate) => candidate.key === key) ?? null
  )
}

export function isFactDefinitionSupported(
  definition: FactDefinition,
  propertyType: PropertyType,
): boolean {
  return definition.propertyTypes.some(
    (candidate) => candidate === propertyType,
  )
}

export function resolveFactDefinition(
  key: string,
  propertyType: PropertyType,
): FactDefinition | null {
  const definition = resolveFactDefinitionByKey(key)

  return definition && isFactDefinitionSupported(definition, propertyType)
    ? definition
    : null
}
