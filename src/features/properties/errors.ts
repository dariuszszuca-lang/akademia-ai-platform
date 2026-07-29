export const propertyFactConflictCode =
  'PROPERTY_FACT_SEMANTIC_CONFLICT' as const
export const propertyFactConflictPolicy =
  'preserve_existing_fact' as const

export class PropertyFactConflictError extends Error {
  readonly code = propertyFactConflictCode
  readonly policy = propertyFactConflictPolicy

  constructor() {
    super(propertyFactConflictCode)
    this.name = 'PropertyFactConflictError'
  }
}

export function mapPropertyFactWriteError(error: unknown): unknown {
  let candidate = error

  for (let depth = 0; depth < 4 && isRecord(candidate); depth += 1) {
    if (
      candidate.code === '23505' &&
      [
        'property_facts_project_key_idx',
        'property_facts_project_semantic_key_idx',
      ].includes(String(candidate.constraint))
    ) {
      return new PropertyFactConflictError()
    }
    candidate = candidate.cause
  }

  return error
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
