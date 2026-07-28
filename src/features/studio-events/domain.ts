import { z } from 'zod'

export const studioEventNames = [
  'studio.session_started',
  'property.created',
  'property.opened',
  'fact.created',
  'fact.updated',
  'source.registered',
  'source.review_ready',
  'proposal.decided',
  'property.ready_reached',
  'account.exported',
  'account.deleted',
] as const

export const allowedMetadataKeys = [
  'propertyType',
  'transactionType',
  'stage',
  'factStatus',
  'sourceStatus',
  'proposalStatus',
  'decisionAction',
  'count',
  'durationMs',
  'providerCostMicrounits',
  'pipelineVersion',
  'modelFamily',
] as const

const allowedMetadataKeySet = new Set<string>(allowedMetadataKeys)

export const studioEventNameSchema = z.enum(studioEventNames)

const studioEventMetadataSchema = z
  .record(z.string(), z.unknown())
  .superRefine((metadata, context) => {
    for (const [key, value] of Object.entries(metadata)) {
      const scalar =
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      const boundedString =
        typeof value !== 'string' || value.length <= 240
      const finiteNumber =
        typeof value !== 'number' || Number.isFinite(value)

      if (
        !allowedMetadataKeySet.has(key) ||
        !scalar ||
        !boundedString ||
        !finiteNumber
      ) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'STUDIO_EVENT_METADATA_NOT_ALLOWED',
        })
      }
    }
  })
  .transform((metadata) => metadata as StudioEventMetadata)

export const studioEventInputSchema = z
  .object({
    organizationId: z.uuid(),
    userId: z.string().trim().min(1).max(240),
    propertyProjectId: z.uuid().nullable().optional(),
    name: studioEventNameSchema,
    contractVersion: z.literal('studio-events-v1'),
    metadata: studioEventMetadataSchema.default({}),
  })
  .strict()

export type StudioEventName = (typeof studioEventNames)[number]
export type StudioEventMetadata = Partial<
  Record<
    (typeof allowedMetadataKeys)[number],
    string | number | boolean | null
  >
>
export type StudioEventInput = z.infer<
  typeof studioEventInputSchema
>
export type StudioProductEvent = StudioEventInput & {
  id: string
  createdAt: Date
}

export interface StudioEventSink {
  record(input: StudioEventInput): Promise<void>
}

export const noopStudioEventSink: StudioEventSink = {
  async record() {},
}
