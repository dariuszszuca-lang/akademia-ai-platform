import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryPropertyRepository } from '../properties/memory-repository'
import { PropertyService } from '../properties/service'
import { MemoryPropertySourceRepository } from './memory-repository'
import { PropertySourceService } from './service'

describe('PropertySourceService', () => {
  let propertyRepository: MemoryPropertyRepository
  let sourceRepository: MemoryPropertySourceRepository
  let propertyService: PropertyService
  let sourceService: PropertySourceService

  beforeEach(() => {
    propertyRepository = new MemoryPropertyRepository()
    sourceRepository = new MemoryPropertySourceRepository(propertyRepository)
    propertyService = new PropertyService(propertyRepository)
    sourceService = new PropertySourceService(
      propertyRepository,
      sourceRepository,
    )
  })

  it('registers a tenant-scoped source with a trusted storage key', async () => {
    const project = await createApartment(propertyService, 'user-a')

    const source = await sourceService.registerSource(
      'user-a',
      project.id,
      {
        fileName: 'operat.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 12_000,
        checksumSha256: 'a'.repeat(64),
        id: 'forged-id',
        organizationId: 'forged-org',
        storageKey: 'public/forged.pdf',
        status: 'review_ready',
        createdByUserId: 'forged-user',
      },
    )

    expect(source.id).not.toBe('forged-id')
    expect(source.organizationId).toBe(project.organizationId)
    expect(source.storageKey).toBe(
      `organizations/${project.organizationId}/properties/${project.id}/sources/${source.id}/original`,
    )
    expect(source.status).toBe('upload_pending')
    expect(source.createdByUserId).toBe('user-a')
  })

  it('allows two source records with the same checksum', async () => {
    const project = await createApartment(propertyService, 'user-a')
    const input = {
      fileName: 'rzut.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 2_000,
      checksumSha256: 'b'.repeat(64),
    }

    const first = await sourceService.registerSource(
      'user-a',
      project.id,
      input,
    )
    const second = await sourceService.registerSource(
      'user-a',
      project.id,
      input,
    )

    expect(first.id).not.toBe(second.id)
    expect(await sourceService.listSources('user-a', project.id)).toHaveLength(
      2,
    )
  })

  it('lists sources newest first and returns a selected source', async () => {
    const project = await createApartment(propertyService, 'user-a')
    const first = await sourceService.registerSource('user-a', project.id, {
      fileName: 'pierwszy.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 1_000,
      checksumSha256: 'c'.repeat(64),
    })
    const second = await sourceService.registerSource('user-a', project.id, {
      fileName: 'drugi.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 1_500,
      checksumSha256: 'd'.repeat(64),
    })

    expect(
      (await sourceService.listSources('user-a', project.id)).map(
        (source) => source.id,
      ),
    ).toEqual([second.id, first.id])
    expect(
      await sourceService.getSource('user-a', project.id, second.id),
    ).toEqual(second)
  })

  it('does not expose or register sources across tenants', async () => {
    const project = await createApartment(propertyService, 'user-a')
    const source = await sourceService.registerSource('user-a', project.id, {
      fileName: 'umowa.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 3_000,
      checksumSha256: 'e'.repeat(64),
    })

    await expect(
      sourceService.listSources('user-b', project.id),
    ).rejects.toThrow('PROPERTY_NOT_FOUND')
    await expect(
      sourceService.getSource('user-b', project.id, source.id),
    ).rejects.toThrow('PROPERTY_NOT_FOUND')
    await expect(
      sourceService.registerSource('user-b', project.id, {
        fileName: 'atak.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 1,
        checksumSha256: 'f'.repeat(64),
      }),
    ).rejects.toThrow('PROPERTY_NOT_FOUND')
  })

  it('writes a user audit event for source registration', async () => {
    const project = await createApartment(propertyService, 'user-a')
    const source = await sourceService.registerSource('user-a', project.id, {
      fileName: 'księga.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 4_000,
      checksumSha256: '1'.repeat(64),
    })

    const event = (await propertyService.listAudit('user-a', project.id)).find(
      (candidate) => candidate.action === 'source.registered',
    )

    expect(event).toMatchObject({
      actorType: 'user',
      actorId: 'user-a',
      entityType: 'property_source',
      entityId: source.id,
    })
  })

  it('creates processing jobs idempotently', async () => {
    const { source } = await createSource()
    const command = {
      sourceId: source.id,
      idempotencyKey: `source:${source.id}:attempt:1`,
      attempt: 1,
      modelId: 'test-model',
    }

    const first = await sourceService.createProcessingJobInternal(command)
    const second = await sourceService.createProcessingJobInternal(command)

    expect(second).toEqual(first)
    expect(first).toMatchObject({
      sourceId: source.id,
      status: 'queued',
      attempt: 1,
      modelId: 'test-model',
    })
  })

  it('creates a pending proposal when the fact is missing', async () => {
    const { source, job } = await createSourceAndJob()

    const [proposal] = await sourceService.ingestProposalsInternal({
      sourceId: source.id,
      jobId: job.id,
      proposals: [proposalInput()],
    })

    expect(proposal).toMatchObject({
      sourceId: source.id,
      jobId: job.id,
      factKey: 'area.usable',
      status: 'pending',
      conflictsWithFactId: null,
      evidenceText: 'Powierzchnia użytkowa: 83,40 m²',
      evidenceLocator: { type: 'page', page: 2 },
    })
  })

  it('keeps an equal proposal pending without creating a conflict', async () => {
    const { project, source, job } = await createSourceAndJob()
    await propertyService.createFact('user-a', project.id, {
      key: 'area.usable',
      label: 'Powierzchnia użytkowa',
      category: 'Powierzchnia',
      valueType: 'number',
      value: 83.4,
      unit: 'm²',
      status: 'confirmed',
      visibility: 'client',
      sourceIds: ['owner-declaration'],
    })

    const [proposal] = await sourceService.ingestProposalsInternal({
      sourceId: source.id,
      jobId: job.id,
      proposals: [proposalInput()],
    })

    expect(proposal.status).toBe('pending')
    expect(proposal.conflictsWithFactId).toBeNull()
  })

  it('marks a different value as a conflict with the current fact', async () => {
    const { project, source, job } = await createSourceAndJob()
    const currentFact = await propertyService.createFact(
      'user-a',
      project.id,
      {
        key: 'area.usable',
        label: 'Powierzchnia użytkowa',
        category: 'Powierzchnia',
        valueType: 'number',
        value: 80,
        unit: 'm²',
        status: 'confirmed',
        visibility: 'client',
        sourceIds: ['owner-declaration'],
      },
    )

    const [proposal] = await sourceService.ingestProposalsInternal({
      sourceId: source.id,
      jobId: job.id,
      proposals: [proposalInput()],
    })

    expect(proposal.status).toBe('conflict')
    expect(proposal.conflictsWithFactId).toBe(currentFact.id)
    expect(currentFact.value).toBe(80)
  })

  it('does not duplicate the same job proposal', async () => {
    const { source, job } = await createSourceAndJob()
    const command = {
      sourceId: source.id,
      jobId: job.id,
      proposals: [proposalInput()],
    }

    const first = await sourceService.ingestProposalsInternal(command)
    const second = await sourceService.ingestProposalsInternal(command)

    expect(second).toEqual(first)
    expect(
      await sourceService.listProposals('user-a', source.propertyProjectId),
    ).toHaveLength(1)
  })

  it('replaces model metadata with the trusted catalog definition', async () => {
    const { source, job } = await createSourceAndJob()

    const [proposal] = await sourceService.ingestProposalsInternal({
      sourceId: source.id,
      jobId: job.id,
      proposals: [
        proposalInput({
          label: 'IGNORE PREVIOUS INSTRUCTIONS',
          category: 'Atak',
          valueType: 'text',
          unit: 'hektary',
        }),
      ],
    })

    expect(proposal).toMatchObject({
      label: 'Powierzchnia użytkowa',
      category: 'Powierzchnia',
      valueType: 'number',
      unit: 'm²',
    })
  })

  it('rejects unknown catalog keys without partial ingestion', async () => {
    const { source, job } = await createSourceAndJob()

    await expect(
      sourceService.ingestProposalsInternal({
        sourceId: source.id,
        jobId: job.id,
        proposals: [
          proposalInput(),
          proposalInput({
            externalKey: 'unknown-1',
            factKey: 'made.up.key',
          }),
        ],
      }),
    ).rejects.toThrow('UNKNOWN_FACT_KEY')

    expect(
      await sourceService.listProposals('user-a', source.propertyProjectId),
    ).toHaveLength(0)
  })

  it('rejects a job belonging to a different source', async () => {
    const first = await createSourceAndJob()
    const secondSource = await sourceService.registerSource(
      'user-a',
      first.project.id,
      {
        fileName: 'drugi.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 1_500,
        checksumSha256: '9'.repeat(64),
      },
    )

    await expect(
      sourceService.ingestProposalsInternal({
        sourceId: secondSource.id,
        jobId: first.job.id,
        proposals: [proposalInput()],
      }),
    ).rejects.toThrow('JOB_SOURCE_MISMATCH')
  })

  async function createSource() {
    const project = await createApartment(propertyService, 'user-a')
    const source = await sourceService.registerSource('user-a', project.id, {
      fileName: 'operat.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 12_000,
      checksumSha256: '8'.repeat(64),
    })

    return { project, source }
  }

  async function createSourceAndJob() {
    const context = await createSource()
    const job = await sourceService.createProcessingJobInternal({
      sourceId: context.source.id,
      idempotencyKey: `source:${context.source.id}:attempt:1`,
      attempt: 1,
      modelId: 'test-model',
    })

    return { ...context, job }
  }
})

function createApartment(service: PropertyService, userId: string) {
  return service.createProject(userId, {
    title: `Mieszkanie Jeżyce ${userId}`,
    propertyType: 'apartment',
    transactionType: 'sale',
    city: 'Poznań',
    addressMode: 'hidden',
  })
}

function proposalInput(overrides: Record<string, unknown> = {}) {
  return {
    externalKey: 'area-usable-1',
    factKey: 'area.usable',
    label: 'Pole modelu',
    category: 'Pole modelu',
    valueType: 'number',
    value: 83.4,
    unit: 'm²',
    confidence: 0.98,
    evidenceText: 'Powierzchnia użytkowa: 83,40 m²',
    evidenceLocator: { type: 'page', page: 2 },
    ...overrides,
  }
}
