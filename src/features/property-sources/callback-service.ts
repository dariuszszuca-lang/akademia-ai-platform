import { z } from 'zod'
import type { PropertyRepository } from '../properties/repository'
import {
  noopStudioEventSink,
  type StudioEventInput,
  type StudioEventSink,
  type StudioEventMetadata,
} from '../studio-events/domain'
import {
  CALLBACK_MAX_AGE_SECONDS,
  hashCallbackNonce,
} from './callback-auth'
import { propertyFactCatalog } from './catalog'
import { ingestFactProposalSchema } from './domain'
import type {
  PropertySourceRepository,
  SourceJobUpdate,
} from './repository'
import type { PropertySourceService } from './service'

const pipelineVersionSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9._-]{0,79}$/)

const contextCommandSchema = z
  .object({
    sourceId: z.string().uuid(),
    idempotencyKey: z.string().trim().min(8).max(240),
    attempt: z.number().int().positive().max(20),
    pipelineVersion: pipelineVersionSchema,
  })
  .strict()

const resultIdentityShape = {
  sourceId: z.string().uuid(),
  jobId: z.string().uuid(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  attempt: z.number().int().positive().max(20),
  pipelineVersion: pipelineVersionSchema,
}

const providerSchema = z.enum([
  'amazon-bedrock',
  'amazon-transcribe',
  'aws-hybrid',
])
const modelIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .regex(/^[A-Za-z0-9._:/-]+$/)
const tokenCountSchema = z.number().int().nonnegative().max(10_000_000)
const durationMsSchema = z.number().int().nonnegative().max(3_600_000)
const providerCostSchema = z.number().int().nonnegative().max(1_000_000_000)
const proposalOutputSchema = ingestFactProposalSchema.strict()

const successfulResultSchema = z
  .object({
    ...resultIdentityShape,
    outcome: z.literal('succeeded'),
    provider: providerSchema,
    modelId: modelIdSchema,
    inputTokens: tokenCountSchema.optional(),
    outputTokens: tokenCountSchema.optional(),
    durationMs: durationMsSchema,
    providerCostMicrounits: providerCostSchema,
    currency: z.literal('USD'),
    proposals: z.array(proposalOutputSchema).max(200),
  })
  .strict()

const safeFailureMessages = {
  DOCUMENT_LIMIT_EXCEEDED: 'Źródło przekracza bezpieczny limit przetwarzania.',
  EXTRACTION_FAILED: 'Nie udało się automatycznie odczytać źródła.',
  NO_EVIDENCE: 'W źródle nie znaleziono danych możliwych do potwierdzenia.',
  OBJECT_VALIDATION_FAILED: 'Źródło nie przeszło kontroli technicznej.',
  PROPOSAL_VALIDATION_FAILED:
    'Wynik automatycznej analizy wymaga ręcznej weryfikacji.',
  STRUCTURED_OUTPUT_INVALID:
    'Wynik automatycznej analizy wymaga ręcznej weryfikacji.',
  TRANSCRIPTION_FAILED: 'Nie udało się przygotować transkrypcji źródła.',
  UNSUPPORTED_MEDIA: 'Ten format źródła nie jest obsługiwany.',
} as const

const safeFailureCodeSchema = z.enum(
  Object.keys(safeFailureMessages) as [
    keyof typeof safeFailureMessages,
    ...(keyof typeof safeFailureMessages)[],
  ],
)

const failedResultSchema = z
  .object({
    ...resultIdentityShape,
    outcome: z.literal('failed'),
    errorCode: safeFailureCodeSchema,
  })
  .strict()

const manualReviewResultSchema = z
  .object({
    ...resultIdentityShape,
    outcome: z.literal('needs_manual_review'),
    errorCode: safeFailureCodeSchema,
    provider: providerSchema.optional(),
    modelId: modelIdSchema.optional(),
    inputTokens: tokenCountSchema.optional(),
    outputTokens: tokenCountSchema.optional(),
    durationMs: durationMsSchema.optional(),
    providerCostMicrounits: providerCostSchema.optional(),
    currency: z.literal('USD').optional(),
  })
  .strict()

const extractionResultSchema = z.discriminatedUnion('outcome', [
  successfulResultSchema,
  failedResultSchema,
  manualReviewResultSchema,
])

const resultIdentitySchema = z.object(resultIdentityShape)

export type AuthenticatedCallback = {
  nonce: string
  timestampSeconds: number
  receivedAt: Date
}

export class PropertySourceCallbackService {
  constructor(
    private readonly propertyRepository: PropertyRepository,
    private readonly sourceRepository: PropertySourceRepository,
    private readonly sourceService: PropertySourceService,
    private readonly events: StudioEventSink = noopStudioEventSink,
  ) {}

  async getExtractionContext(
    rawCommand: unknown,
    auth: AuthenticatedCallback,
  ) {
    const command = contextCommandSchema.parse(rawCommand)
    const source = await this.sourceRepository.getSourceInternal(
      command.sourceId,
    )
    if (!source) throw new Error('SOURCE_NOT_FOUND')

    const project = await this.propertyRepository.getProject(
      source.createdByUserId,
      source.propertyProjectId,
    )
    if (!project || project.organizationId !== source.organizationId) {
      throw new Error('SOURCE_CONTEXT_NOT_FOUND')
    }

    const job = await this.sourceService.createProcessingJobInternal(command)
    if (
      job.sourceId !== source.id ||
      job.attempt !== command.attempt ||
      job.pipelineVersion !== command.pipelineVersion
    ) {
      throw new Error('JOB_CONTEXT_MISMATCH')
    }

    await this.claimNonce(job.id, auth)
    await this.advanceSourceToProcessing(source.id, auth.receivedAt)
    const runningJob = await this.sourceRepository.updateJobInternal(job.id, {
      status: 'running',
      pipelineVersion: command.pipelineVersion,
      startedAt: job.startedAt ?? auth.receivedAt,
      errorCode: null,
      errorMessage: null,
    })
    if (!runningJob) throw new Error('JOB_NOT_FOUND')

    return {
      jobId: runningJob.id,
      source: {
        id: source.id,
        checksumSha256: source.checksumSha256,
        sizeBytes: source.sizeBytes,
        mediaType: source.mediaType,
        storageKey: source.storageKey,
      },
      property: {
        propertyType: project.propertyType,
        transactionType: project.transactionType,
      },
      factCatalog: propertyFactCatalog
        .filter((definition) =>
          (definition.propertyTypes as readonly string[]).includes(
            project.propertyType,
          ),
        )
        .map((definition) => ({
          key: definition.key,
          label: definition.label,
          category: definition.category,
          valueType: definition.valueType,
          ...('unit' in definition ? { unit: definition.unit } : {}),
        })),
    }
  }

  async submitExtractionResult(
    rawResult: unknown,
    auth: AuthenticatedCallback,
  ) {
    const identity = resultIdentitySchema.parse(rawResult)
    await this.claimNonce(identity.jobId, auth)
    const result = extractionResultSchema.parse(rawResult)
    const { source, job } = await this.requireMatchingResultContext(result)

    if (result.outcome === 'succeeded') {
      const proposals =
        result.proposals.length === 0
          ? []
          : await this.sourceService.ingestProposalsInternal({
              sourceId: source.id,
              jobId: job.id,
              proposals: result.proposals,
            })

      const updatedSource =
        await this.sourceRepository.updateSourceStatusInternal(source.id, {
          status: 'review_ready',
          errorCode: null,
          errorMessage: null,
          processedAt: auth.receivedAt,
        })
      if (!updatedSource) throw new Error('SOURCE_NOT_FOUND')

      const updatedJob = await this.sourceRepository.updateJobInternal(
        job.id,
        this.resultJobUpdate(result, auth.receivedAt, 'succeeded'),
      )
      if (!updatedJob) throw new Error('JOB_NOT_FOUND')
      await this.recordReviewReadyEvent(source, result)

      return {
        accepted: true as const,
        outcome: result.outcome,
        proposalCount: proposals.length,
      }
    }

    const errorMessage = safeFailureMessages[result.errorCode]
    const sourceStatus =
      result.outcome === 'needs_manual_review' ? 'review_ready' : 'failed'
    const jobStatus =
      result.outcome === 'needs_manual_review'
        ? 'needs_manual_review'
        : 'failed'

    const updatedSource =
      await this.sourceRepository.updateSourceStatusInternal(source.id, {
        status: sourceStatus,
        errorCode: result.errorCode,
        errorMessage,
        processedAt: auth.receivedAt,
      })
    if (!updatedSource) throw new Error('SOURCE_NOT_FOUND')

    const updatedJob = await this.sourceRepository.updateJobInternal(job.id, {
      ...this.resultJobUpdate(result, auth.receivedAt, jobStatus),
      errorCode: result.errorCode,
      errorMessage,
    })
    if (!updatedJob) throw new Error('JOB_NOT_FOUND')
    if (sourceStatus === 'review_ready') {
      await this.recordReviewReadyEvent(source, result)
    }

    return {
      accepted: true as const,
      outcome: result.outcome,
      proposalCount: 0,
    }
  }

  private async claimNonce(
    jobId: string,
    auth: AuthenticatedCallback,
  ) {
    const expiresAt = new Date(
      (auth.timestampSeconds + CALLBACK_MAX_AGE_SECONDS) * 1000,
    )
    if (
      !Number.isSafeInteger(auth.timestampSeconds) ||
      Number.isNaN(auth.receivedAt.getTime()) ||
      expiresAt < auth.receivedAt
    ) {
      throw new Error('CALLBACK_AUTH_STALE')
    }

    await this.sourceRepository.claimCallbackNonceInternal({
      jobId,
      nonceHash: hashCallbackNonce(auth.nonce),
      expiresAt,
      usedAt: auth.receivedAt,
    })
  }

  private async advanceSourceToProcessing(
    sourceId: string,
    receivedAt: Date,
  ) {
    for (;;) {
      const source = await this.sourceRepository.getSourceInternal(sourceId)
      if (!source) throw new Error('SOURCE_NOT_FOUND')

      const update = nextProcessingSourceUpdate(source.status, receivedAt)
      if (!update) {
        if (source.status === 'processing') return
        throw new Error('SOURCE_NOT_READY')
      }

      await this.sourceRepository.updateSourceStatusInternal(source.id, update)
    }
  }

  private async requireMatchingResultContext(
    result: z.infer<typeof extractionResultSchema>,
  ) {
    const job = await this.sourceRepository.getJobInternal(result.jobId)
    if (!job) throw new Error('JOB_NOT_FOUND')
    const source = await this.sourceRepository.getSourceInternal(result.sourceId)
    if (!source) throw new Error('SOURCE_NOT_FOUND')

    if (
      job.sourceId !== source.id ||
      job.organizationId !== source.organizationId ||
      job.propertyProjectId !== source.propertyProjectId
    ) {
      throw new Error('JOB_SOURCE_MISMATCH')
    }
    if (
      job.attempt !== result.attempt ||
      job.pipelineVersion !== result.pipelineVersion
    ) {
      throw new Error('JOB_CONTEXT_MISMATCH')
    }
    if (
      source.checksumSha256.toLowerCase() !==
      result.checksumSha256.toLowerCase()
    ) {
      throw new Error('SOURCE_CHECKSUM_MISMATCH')
    }
    if (!['running', 'waiting_external'].includes(job.status)) {
      throw new Error('JOB_NOT_ACTIVE')
    }
    if (source.status !== 'processing') {
      throw new Error('SOURCE_NOT_READY')
    }

    return { source, job }
  }

  private resultJobUpdate(
    result: z.infer<typeof extractionResultSchema>,
    completedAt: Date,
    status: SourceJobUpdate['status'],
  ): SourceJobUpdate {
    const providerCostMicrounits =
      'providerCostMicrounits' in result
        ? (result.providerCostMicrounits ?? null)
        : null
    const currency =
      'currency' in result ? (result.currency ?? null) : null

    return {
      status,
      pipelineVersion: result.pipelineVersion,
      provider: 'provider' in result ? (result.provider ?? null) : null,
      modelId: 'modelId' in result ? (result.modelId ?? null) : null,
      inputTokens:
        'inputTokens' in result ? (result.inputTokens ?? null) : null,
      outputTokens:
        'outputTokens' in result ? (result.outputTokens ?? null) : null,
      durationMs:
        'durationMs' in result ? (result.durationMs ?? null) : null,
      providerCostMicrounits,
      currency,
      estimatedCostUsd:
        currency === 'USD' && providerCostMicrounits !== null
          ? microunitsToUsd(providerCostMicrounits)
          : null,
      completedAt,
    }
  }

  private async recordReviewReadyEvent(
    source: {
      organizationId: string
      propertyProjectId: string
      createdByUserId: string
    },
    result: z.infer<typeof extractionResultSchema>,
  ) {
    const metadata: StudioEventMetadata = {
      sourceStatus: 'review_ready',
      pipelineVersion: result.pipelineVersion,
      ...('durationMs' in result && result.durationMs !== undefined
        ? { durationMs: result.durationMs }
        : {}),
      ...('providerCostMicrounits' in result &&
      result.providerCostMicrounits !== undefined
        ? { providerCostMicrounits: result.providerCostMicrounits }
        : {}),
      ...('provider' in result && result.provider !== undefined
        ? { modelFamily: result.provider }
        : {}),
    }
    await this.recordStudioEvent({
      organizationId: source.organizationId,
      userId: source.createdByUserId,
      propertyProjectId: source.propertyProjectId,
      name: 'source.review_ready',
      contractVersion: 'studio-events-v1',
      metadata,
    })
  }

  private async recordStudioEvent(input: StudioEventInput) {
    try {
      await this.events.record(input)
    } catch {
      console.error('studio_event_write_failed')
    }
  }
}

function nextProcessingSourceUpdate(
  status:
    | 'upload_pending'
    | 'uploaded'
    | 'scanning'
    | 'quarantined'
    | 'validating'
    | 'queued'
    | 'processing'
    | 'review_ready'
    | 'completed'
    | 'failed'
    | 'deleted',
  receivedAt: Date,
) {
  switch (status) {
    case 'upload_pending':
      return {
        status: 'uploaded' as const,
        uploadedAt: receivedAt,
      }
    case 'uploaded':
      return { status: 'scanning' as const }
    case 'scanning':
      return { status: 'validating' as const }
    case 'validating':
      return { status: 'queued' as const }
    case 'queued':
      return { status: 'processing' as const }
    default:
      return null
  }
}

function microunitsToUsd(microunits: number): string {
  const dollars = Math.floor(microunits / 1_000_000)
  const remainder = String(microunits % 1_000_000).padStart(6, '0')
  return `${dollars}.${remainder}`
}
