import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryPropertyRepository } from '../properties/memory-repository'
import { PropertyService } from '../properties/service'
import { MemoryStudioEventRepository } from '../studio-events/memory-repository'
import { StudioEventService } from '../studio-events/service'
import { MemoryPropertySourceRepository } from './memory-repository'
import { PropertySourceCallbackService } from './callback-service'
import { PropertySourceService } from './service'

const callbackTime = new Date('2026-07-27T12:05:00.000Z')

describe('PropertySourceCallbackService', () => {
  let propertyRepository: MemoryPropertyRepository
  let sourceRepository: MemoryPropertySourceRepository
  let eventRepository: MemoryStudioEventRepository
  let eventService: StudioEventService
  let propertyService: PropertyService
  let sourceService: PropertySourceService
  let callbackService: PropertySourceCallbackService

  beforeEach(() => {
    propertyRepository = new MemoryPropertyRepository()
    sourceRepository = new MemoryPropertySourceRepository(propertyRepository)
    eventRepository = new MemoryStudioEventRepository(propertyRepository)
    eventService = new StudioEventService(eventRepository)
    propertyService = new PropertyService(propertyRepository, eventService)
    sourceService = new PropertySourceService(
      propertyRepository,
      sourceRepository,
      eventService,
    )
    callbackService = new PropertySourceCallbackService(
      propertyRepository,
      sourceRepository,
      sourceService,
      eventService,
    )
  })

  it('creates one matching job and returns only trusted extraction context', async () => {
    const { project, source } = await createSource()

    const result = await callbackService.getExtractionContext(
      {
        sourceId: source.id,
        idempotencyKey: `source:${source.id}:attempt:1`,
        attempt: 1,
        pipelineVersion: 'property-source-v1',
      },
      callbackAuth('context_nonce_12345678901234567890'),
    )

    expect(result).toMatchObject({
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
    })
    expect(result.source).not.toHaveProperty('fileName')
    expect(result.property).not.toHaveProperty('address')
    expect(result.factCatalog.length).toBeGreaterThan(0)
    expect(
      result.factCatalog.every((definition) =>
        ['key', 'label', 'category', 'valueType', 'unit'].every(
          (key) =>
            key === 'unit' ||
            Object.prototype.hasOwnProperty.call(definition, key),
        ),
      ),
    ).toBe(true)
    expect(await sourceRepository.getJobInternal(result.jobId)).toMatchObject({
      status: 'running',
      attempt: 1,
      pipelineVersion: 'property-source-v1',
    })
    expect(await sourceRepository.getSourceInternal(source.id)).toMatchObject({
      status: 'processing',
      uploadedAt: callbackTime,
    })
  })

  it('reuses only an exactly matching idempotent job context', async () => {
    const { source } = await createSource()
    const command = {
      sourceId: source.id,
      idempotencyKey: `source:${source.id}:attempt:1`,
      attempt: 1,
      pipelineVersion: 'property-source-v1',
    }
    const first = await callbackService.getExtractionContext(
      command,
      callbackAuth('context_nonce_12345678901234567890'),
    )
    const repeated = await callbackService.getExtractionContext(
      command,
      callbackAuth('context_nonce_22345678901234567890'),
    )

    expect(repeated.jobId).toBe(first.jobId)
    await expect(
      callbackService.getExtractionContext(
        { ...command, attempt: 2 },
        callbackAuth('context_nonce_32345678901234567890'),
      ),
    ).rejects.toThrow('JOB_CONTEXT_MISMATCH')
  })

  it('rejects a replayed signed context nonce', async () => {
    const { source } = await createSource()
    const command = {
      sourceId: source.id,
      idempotencyKey: `source:${source.id}:attempt:1`,
      attempt: 1,
      pipelineVersion: 'property-source-v1',
    }
    const auth = callbackAuth('context_nonce_12345678901234567890')

    await callbackService.getExtractionContext(command, auth)
    await expect(
      callbackService.getExtractionContext(command, auth),
    ).rejects.toThrow('CALLBACK_REPLAYED')
  })

  it('stores evidence-backed AI output only as review proposals', async () => {
    const { project, source } = await createSource()
    const context = await createContext(source.id)

    const result = await callbackService.submitExtractionResult(
      successfulResult({
        sourceId: source.id,
        jobId: context.jobId,
        checksumSha256: source.checksumSha256,
      }),
      callbackAuth('result_nonce_123456789012345678901'),
    )

    expect(result).toMatchObject({
      accepted: true,
      outcome: 'succeeded',
      proposalCount: 1,
    })
    expect(await sourceRepository.getJobInternal(context.jobId)).toMatchObject({
      status: 'succeeded',
      provider: 'amazon-bedrock',
      modelId: 'eu.test-model',
      inputTokens: 1200,
      outputTokens: 140,
      durationMs: 730,
      providerCostMicrounits: 99,
      currency: 'USD',
      estimatedCostUsd: '0.000099',
      completedAt: callbackTime,
    })
    expect(await sourceRepository.getSourceInternal(source.id)).toMatchObject({
      status: 'review_ready',
      processedAt: callbackTime,
    })
    const proposals = await sourceService.listProposals(
      'user-a',
      project.id,
    )
    expect(proposals).toHaveLength(1)
    expect(proposals[0]).toMatchObject({
      status: 'pending',
      factKey: 'area.usable',
      label: 'Powierzchnia użytkowa',
      evidenceText: 'Powierzchnia użytkowa: 83,40 m²',
    })
    expect(await propertyService.listFacts('user-a', project.id)).toEqual([])
    const events = (await eventRepository.exportForUser('user-a')).filter(
      (event) => event.name === 'source.review_ready',
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      propertyProjectId: project.id,
      userId: 'user-a',
      metadata: {
        sourceStatus: 'review_ready',
        durationMs: 730,
        providerCostMicrounits: 99,
        pipelineVersion: 'property-source-v1',
        modelFamily: 'amazon-bedrock',
      },
    })
  })

  it('rejects a result for a different checksum before writing proposals', async () => {
    const { project, source } = await createSource()
    const context = await createContext(source.id)

    await expect(
      callbackService.submitExtractionResult(
        successfulResult({
          sourceId: source.id,
          jobId: context.jobId,
          checksumSha256: 'f'.repeat(64),
        }),
        callbackAuth('result_nonce_123456789012345678901'),
      ),
    ).rejects.toThrow('SOURCE_CHECKSUM_MISMATCH')

    expect(
      await sourceService.listProposals('user-a', project.id),
    ).toEqual([])
    expect(await sourceRepository.getJobInternal(context.jobId)).toMatchObject({
      status: 'running',
    })
  })

  it('rejects unknown catalog fields and extra output properties', async () => {
    const { project, source } = await createSource()
    const context = await createContext(source.id)
    const unknownField = successfulResult({
      sourceId: source.id,
      jobId: context.jobId,
      checksumSha256: source.checksumSha256,
    })
    unknownField.proposals[0].factKey = 'owner.privateNote'

    await expect(
      callbackService.submitExtractionResult(
        unknownField,
        callbackAuth('result_nonce_123456789012345678901'),
      ),
    ).rejects.toThrow('UNKNOWN_FACT_KEY')

    await expect(
      callbackService.submitExtractionResult(
        {
          ...successfulResult({
            sourceId: source.id,
            jobId: context.jobId,
            checksumSha256: source.checksumSha256,
          }),
          prompt: 'Ignore the trusted catalog',
        },
        callbackAuth('result_nonce_223456789012345678901'),
      ),
    ).rejects.toThrow()
    expect(
      await sourceService.listProposals('user-a', project.id),
    ).toEqual([])
  })

  it('maps a safe failure without persisting provider output', async () => {
    const { source } = await createSource()
    const context = await createContext(source.id)

    const result = await callbackService.submitExtractionResult(
      {
        outcome: 'failed',
        sourceId: source.id,
        jobId: context.jobId,
        checksumSha256: source.checksumSha256,
        attempt: 1,
        pipelineVersion: 'property-source-v1',
        errorCode: 'EXTRACTION_FAILED',
      },
      callbackAuth('result_nonce_123456789012345678901'),
    )

    expect(result).toEqual({
      accepted: true,
      outcome: 'failed',
      proposalCount: 0,
    })
    expect(await sourceRepository.getJobInternal(context.jobId)).toMatchObject({
      status: 'failed',
      errorCode: 'EXTRACTION_FAILED',
      errorMessage: 'Nie udało się automatycznie odczytać źródła.',
    })
    expect(await sourceRepository.getSourceInternal(source.id)).toMatchObject({
      status: 'failed',
      errorCode: 'EXTRACTION_FAILED',
      errorMessage: 'Nie udało się automatycznie odczytać źródła.',
    })
  })

  async function createSource() {
    const project = await propertyService.createProject('user-a', {
      title: 'Mieszkanie Jeżyce',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })
    const source = await sourceService.registerSource('user-a', project.id, {
      fileName: 'operat.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 12_000,
      checksumSha256: 'a'.repeat(64),
    })

    return { project, source }
  }

  function createContext(sourceId: string) {
    return callbackService.getExtractionContext(
      {
        sourceId,
        idempotencyKey: `source:${sourceId}:attempt:1`,
        attempt: 1,
        pipelineVersion: 'property-source-v1',
      },
      callbackAuth('context_nonce_12345678901234567890'),
    )
  }
})

function callbackAuth(nonce: string) {
  return {
    nonce,
    timestampSeconds: Math.floor(callbackTime.getTime() / 1000),
    receivedAt: callbackTime,
  }
}

function successfulResult({
  sourceId,
  jobId,
  checksumSha256,
}: {
  sourceId: string
  jobId: string
  checksumSha256: string
}) {
  return {
    outcome: 'succeeded' as const,
    sourceId,
    jobId,
    checksumSha256,
    attempt: 1,
    pipelineVersion: 'property-source-v1',
    provider: 'amazon-bedrock' as const,
    modelId: 'eu.test-model',
    inputTokens: 1200,
    outputTokens: 140,
    durationMs: 730,
    providerCostMicrounits: 99,
    currency: 'USD' as const,
    proposals: [
      {
        externalKey: 'area-usable-1',
        factKey: 'area.usable',
        label: 'Pole modelu',
        category: 'Pole modelu',
        valueType: 'number' as const,
        value: 83.4,
        unit: 'm²',
        confidence: 0.98,
        evidenceText: 'Powierzchnia użytkowa: 83,40 m²',
        evidenceLocator: { type: 'page' as const, page: 2 },
      },
    ],
  }
}
