import {
  MAX_RESULTS_PER_PROPERTY,
  saveToolResultSchema,
  toolResultsKey,
  type ToolResult,
} from './domain'

export type ToolResultStore = {
  get: <T>(key: string) => Promise<T | null>
  set: (key: string, value: unknown) => Promise<void>
}

export type PropertyOwnershipCheck = (
  userId: string,
  propertyId: string,
) => Promise<boolean>

export class ToolResultError extends Error {
  constructor(
    public readonly code: 'invalid' | 'not_found',
    message: string,
  ) {
    super(message)
  }
}

export function createToolResultService(deps: {
  store: ToolResultStore
  ownsProperty: PropertyOwnershipCheck
  now?: () => Date
  newId?: () => string
}) {
  const now = deps.now ?? (() => new Date())
  const newId = deps.newId ?? (() => crypto.randomUUID())

  async function assertOwner(userId: string, propertyId: string) {
    if (!(await deps.ownsProperty(userId, propertyId))) {
      throw new ToolResultError('not_found', 'Nie ma takiej teczki.')
    }
  }

  return {
    async list(userId: string, propertyId: string): Promise<ToolResult[]> {
      await assertOwner(userId, propertyId)
      return (
        (await deps.store.get<ToolResult[]>(
          toolResultsKey(userId, propertyId),
        )) ?? []
      )
    },

    async save(userId: string, input: unknown): Promise<ToolResult> {
      const parsed = saveToolResultSchema.safeParse(input)
      if (!parsed.success) {
        throw new ToolResultError(
          'invalid',
          parsed.error.issues[0]?.message ?? 'Niepoprawne dane.',
        )
      }
      const { propertyId, ...rest } = parsed.data
      await assertOwner(userId, propertyId)

      const key = toolResultsKey(userId, propertyId)
      const existing = (await deps.store.get<ToolResult[]>(key)) ?? []
      const result: ToolResult = {
        ...rest,
        id: newId(),
        createdAt: now().toISOString(),
      }
      const next = [result, ...existing].slice(0, MAX_RESULTS_PER_PROPERTY)
      await deps.store.set(key, next)
      return result
    },
  }
}
