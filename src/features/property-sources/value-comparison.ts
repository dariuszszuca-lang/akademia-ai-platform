export function propertyFactValuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(normalizeJsonValue(left)) === JSON.stringify(
    normalizeJsonValue(right),
  )
}

function normalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue)
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeJsonValue(value[key])]),
    )
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
