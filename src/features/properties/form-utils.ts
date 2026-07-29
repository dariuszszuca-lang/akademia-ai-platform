import {
  isFactDefinitionSupported,
  resolveFactDefinitionByLabel,
  toLegacyFactKey,
  type PropertyFactValueType,
  type PropertyType,
} from '../property-sources/catalog-data'

export function toFactKey(label: string) {
  return toLegacyFactKey(label)
}

export function resolveFactKey(label: string): string {
  return resolveFactDefinitionByLabel(label)?.key ?? toFactKey(label)
}

type CustomFactMetadata = {
  category: string
  valueType: PropertyFactValueType
  unit?: string
}

export function resolveFactInput(
  label: string,
  propertyType: PropertyType,
  customMetadata: CustomFactMetadata,
) {
  const definition = resolveFactDefinitionByLabel(label)

  if (definition) {
    if (!isFactDefinitionSupported(definition, propertyType)) {
      return null
    }

    return {
      key: definition.key,
      category: definition.category,
      valueType: definition.valueType,
      ...('unit' in definition ? { unit: definition.unit } : {}),
    }
  }

  return {
    key: toFactKey(label),
    category: customMetadata.category,
    valueType: customMetadata.valueType,
    ...(customMetadata.unit ? { unit: customMetadata.unit } : {}),
  }
}

export function coerceFactValue(
  value: string,
  valueType: PropertyFactValueType,
) {
  if (valueType === 'number' || valueType === 'money') {
    return Number(value.replace(/\s/g, '').replace(',', '.'))
  }

  if (valueType === 'boolean') {
    return value === 'true'
  }

  if (valueType === 'json') {
    return JSON.parse(value)
  }

  return value
}
