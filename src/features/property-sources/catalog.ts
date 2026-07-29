import {
  isFactDefinitionSupported,
  resolveFactDefinitionByKey,
  type PropertyFactValueType,
  type PropertyType,
} from './catalog-data'

export * from './catalog-data'

type CatalogFactMetadata = {
  key: string
  category: string
  valueType: PropertyFactValueType
  unit?: string
}

export type CatalogFactMetadataIssue = {
  path: 'key' | 'category' | 'valueType' | 'unit'
  message:
    | 'CATALOG_FACT_METADATA_INVALID'
    | 'CATALOG_FACT_PROPERTY_TYPE_UNSUPPORTED'
}

export function validateCatalogFactMetadata(
  input: CatalogFactMetadata,
  propertyType: PropertyType,
): CatalogFactMetadataIssue[] {
  const definition = resolveFactDefinitionByKey(input.key)
  if (!definition) return []

  if (!isFactDefinitionSupported(definition, propertyType)) {
    return [
      {
        path: 'key',
        message: 'CATALOG_FACT_PROPERTY_TYPE_UNSUPPORTED',
      },
    ]
  }

  const issues: CatalogFactMetadataIssue[] = []
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
