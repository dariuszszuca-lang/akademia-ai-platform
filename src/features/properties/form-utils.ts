import type { PropertyFact } from './domain'
import { resolveFactDefinitionByLabel } from '../property-sources/catalog'

export function toFactKey(label: string) {
  const words = label
    .trim()
    .replace(/[łŁ]/g, (character) => (character === 'ł' ? 'l' : 'L'))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return 'fact'

  const [first, ...rest] = words
  const key =
    first.toLowerCase() +
    rest
      .map(
        (word) =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      )
      .join('')

  return /^[a-z]/.test(key) ? key : `fact${key}`
}

export function resolveFactKey(label: string): string {
  return resolveFactDefinitionByLabel(label)?.key ?? toFactKey(label)
}

export function coerceFactValue(
  value: string,
  valueType: PropertyFact['valueType'],
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
