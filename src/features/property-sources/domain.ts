import { z } from 'zod'
import {
  propertyFactValueTypeSchema,
  type PropertyFact,
} from '../properties/domain'

export const propertySourceStatuses = [
  'upload_pending',
  'uploaded',
  'scanning',
  'quarantined',
  'validating',
  'queued',
  'processing',
  'review_ready',
  'completed',
  'failed',
  'deleted',
] as const

export const sourceJobStatuses = [
  'queued',
  'running',
  'waiting_external',
  'succeeded',
  'failed',
  'needs_manual_review',
  'cancelled',
] as const

export const factProposalStatuses = [
  'pending',
  'conflict',
  'accepted',
  'corrected',
  'rejected',
  'needs_review',
] as const

export const supportedSourceMediaTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
] as const

const pageLocatorSchema = z.object({
  type: z.literal('page'),
  page: z.number().int().positive(),
})

const sheetLocatorSchema = z.object({
  type: z.literal('sheet'),
  sheet: z.string().trim().min(1).max(120),
  row: z.number().int().positive(),
  column: z.string().trim().regex(/^[A-Z]{1,3}$/),
})

const timeLocatorSchema = z
  .object({
    type: z.literal('time'),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
  })
  .refine((value) => value.endMs > value.startMs, {
    message: 'Koniec fragmentu musi być później niż początek.',
  })

const textLocatorSchema = z
  .object({
    type: z.literal('text'),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  })
  .refine((value) => value.end > value.start, {
    message: 'Koniec fragmentu musi być później niż początek.',
  })

export const evidenceLocatorSchema = z.discriminatedUnion('type', [
  pageLocatorSchema,
  sheetLocatorSchema,
  timeLocatorSchema,
  textLocatorSchema,
])

export const createPropertySourceSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    mediaType: z.enum(supportedSourceMediaTypes),
    sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  })
  .strip()

export const ingestFactProposalSchema = z.object({
  externalKey: z.string().trim().min(1).max(160),
  factKey: z
    .string()
    .trim()
    .regex(/^[a-z][a-zA-Z0-9._-]*$/)
    .max(100),
  label: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(80),
  valueType: propertyFactValueTypeSchema,
  value: z.json(),
  unit: z.string().trim().max(30).optional(),
  confidence: z.number().min(0).max(1),
  evidenceText: z.string().trim().min(1).max(4000),
  evidenceLocator: evidenceLocatorSchema,
})

const correctedValueSchema = z.json()

export const proposalDecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accept') }),
  z.object({
    action: z.literal('correct_and_accept'),
    value: correctedValueSchema,
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal('reject'),
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal('keep_existing'),
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal('accept_new') }),
  z.object({
    action: z.literal('keep_open'),
    note: z.string().trim().max(1000).optional(),
  }),
])

export type EvidenceLocator = z.infer<typeof evidenceLocatorSchema>
export type CreatePropertySourceInput = z.infer<
  typeof createPropertySourceSchema
>
export type IngestFactProposalInput = z.infer<
  typeof ingestFactProposalSchema
>
export type ProposalDecision = z.infer<typeof proposalDecisionSchema>
export type PropertySourceStatus = (typeof propertySourceStatuses)[number]
export type SourceJobStatus = (typeof sourceJobStatuses)[number]
export type FactProposalStatus = (typeof factProposalStatuses)[number]

export type PropertySource = CreatePropertySourceInput & {
  id: string
  organizationId: string
  propertyProjectId: string
  storageKey: string
  status: PropertySourceStatus
  errorCode: string | null
  errorMessage: string | null
  uploadedAt: Date | null
  processedAt: Date | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
}

export type SourceProcessingJob = {
  id: string
  organizationId: string
  propertyProjectId: string
  sourceId: string
  idempotencyKey: string
  status: SourceJobStatus
  attempt: number
  pipelineVersion: string
  provider: string | null
  modelId: string | null
  inputTokens: number | null
  outputTokens: number | null
  durationMs: number | null
  estimatedCostUsd: string | null
  providerCostMicrounits: number | null
  currency: string | null
  errorCode: string | null
  errorMessage: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type DecisionFactSnapshot = Omit<
  PropertyFact,
  | 'unit'
  | 'confirmedByUserId'
  | 'confirmedAt'
  | 'createdAt'
  | 'updatedAt'
> & {
  unit: string | null
  confirmedByUserId: string | null
  confirmedAt: string | null
  createdAt: string
  updatedAt: string
}

export type PropertyFactProposal = IngestFactProposalInput & {
  id: string
  organizationId: string
  propertyProjectId: string
  sourceId: string
  jobId: string
  status: FactProposalStatus
  conflictsWithFactId: string | null
  decidedByUserId: string | null
  decisionNote: string | null
  decision: ProposalDecision | null
  decisionFingerprint: string | null
  decidedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
