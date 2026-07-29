import {
  normalizeFactLabel,
  resolveFactDefinitionByKey,
  resolveFactDefinitionByLabel,
} from '../property-sources/catalog-data'

type FactIdentityInput = {
  key: string
  label: string
}

export function createPropertyFactSemanticKey(
  input: FactIdentityInput,
): string {
  const definition =
    resolveFactDefinitionByKey(input.key) ??
    resolveFactDefinitionByLabel(input.label)

  return definition
    ? `catalog:${definition.key}`
    : `label:${normalizeFactLabel(input.label)}`
}

export function propertyFactsShareSemanticIdentity(
  first: FactIdentityInput,
  second: FactIdentityInput,
): boolean {
  return (
    createPropertyFactSemanticKey(first) ===
    createPropertyFactSemanticKey(second)
  )
}
