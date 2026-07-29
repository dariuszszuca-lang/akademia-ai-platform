import {
  isFactDefinitionSupported,
  normalizeFactLabel,
  resolveFactDefinitionByLabel,
  resolveFactDefinitionByKey,
  type PropertyFactValueType,
  type PropertyType,
} from './catalog-data'

export * from './catalog-data'

type CatalogFactMetadata = {
  key: string
  label: string
  category: string
  valueType: PropertyFactValueType
  unit?: string
}

export type CatalogFactMetadataIssue = {
  path: 'key' | 'label' | 'category' | 'valueType' | 'unit'
  message:
    | 'CATALOG_FACT_METADATA_INVALID'
    | 'CATALOG_FACT_PROPERTY_TYPE_UNSUPPORTED'
    | 'CATALOG_FACT_KEY_INVALID'
    | 'CATALOG_FACT_LABEL_INVALID'
}

export function validateCatalogFactMetadata(
  input: CatalogFactMetadata,
  propertyType: PropertyType,
): CatalogFactMetadataIssue[] {
  const keyDefinition = resolveFactDefinitionByKey(input.key)
  const labelDefinition = resolveFactDefinitionByLabel(input.label)
  const issues: CatalogFactMetadataIssue[] = []

  if (labelDefinition && input.key !== labelDefinition.key) {
    issues.push({
      path: 'key',
      message: 'CATALOG_FACT_KEY_INVALID',
    })
  }
  if (
    keyDefinition &&
    normalizeFactLabel(input.label) !==
      normalizeFactLabel(keyDefinition.label)
  ) {
    issues.push({
      path: 'label',
      message: 'CATALOG_FACT_LABEL_INVALID',
    })
  }

  const definition = keyDefinition ?? labelDefinition
  if (!definition) return issues

  if (!isFactDefinitionSupported(definition, propertyType)) {
    issues.push({
      path: 'key',
      message: 'CATALOG_FACT_PROPERTY_TYPE_UNSUPPORTED',
    })
  }

  if (input.category !== definition.category) {
    issues.push({
      path: 'category',
      message: 'CATALOG_FACT_METADATA_INVALID',
    })
  }
  if (input.valueType !== definition.valueType) {
    issues.push({
      path: 'valueType',
      message: 'CATALOG_FACT_METADATA_INVALID',
    })
  }
  if (input.unit !== definition.unit) {
    issues.push({
      path: 'unit',
      message: 'CATALOG_FACT_METADATA_INVALID',
    })
  }

  return issues
}
