import { describe, expect, it, vi } from 'vitest'
import { MemoryPropertyRepository } from '../properties/memory-repository'
import { PropertyService } from '../properties/service'
import {
  createPropertySourceHttpHandlers,
  propertySourceErrorResponse,
} from './http'
import { MemoryPropertySourceRepository } from './memory-repository'
import type { PropertySourceObjectStore } from './object-store'
import { PropertySourceService } from './service'
import { PropertySourceUploadService } from './upload-service'

function setup(userId: string | null = 'user-a') {
  const propertyRepository = new MemoryPropertyRepository()
  const sourceRepository = new MemoryPropertySourceRepository(
    propertyRepository,
  )
  const propertyService = new PropertyService(propertyRepository)
  const sourceService = new PropertySourceService(
    propertyRepository,
    sourceRepository,
  )
  const createUploadGrant = vi.fn<
    PropertySourceObjectStore['createUploadGrant']
  >(async () => ({
    method: 'POST',
    url: 'https://upload.example.test',
    fields: { policy: 'signed-policy' },
    expiresAt: '2026-07-27T12:05:00.000Z',
  }))
  const createCleanDownloadUrl = vi.fn<
    PropertySourceObjectStore['createCleanDownloadUrl']
  >(async () => ({
    url: 'https://download.example.test',
    expiresAt: '2026-07-27T12:01:00.000Z',
  }))
  const uploadService = new PropertySourceUploadService(
    sourceService,
    sourceRepository,
    { createUploadGrant, createCleanDownloadUrl },
  )
  const handlers = createPropertySourceHttpHandlers({
    getService: () => sourceService,
    getUploadService: () => uploadService,
    getUserId: async () => userId,
  })

  return {
    handlers,
    propertyService,
    sourceRepository,
    sourceService,
    uploadService,
    createUploadGrant,
    createCleanDownloadUrl,
  }
}

describe('property source HTTP handlers', () => {
  it('returns 401 before accessing property data', async () => {
    const { handlers } = setup(null)

    const response = await handlers.listSources(
      new Request('http://localhost/api/properties/ignored/sources'),
      propertyContext('00000000-0000-4000-8000-000000000001'),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' })
  })

  it('returns 401 before parsing an upload body', async () => {
    const { handlers, createUploadGrant } = setup(null)

    const response = await handlers.createSource(
      new Request('http://localhost/api/properties/ignored/sources', {
        method: 'POST',
        body: '{invalid-json',
      }),
      propertyContext('00000000-0000-4000-8000-000000000001'),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' })
    expect(createUploadGrant).not.toHaveBeenCalled()
  })

  it('returns 201 with an exact upload grant and ignores forged fields', async () => {
    const context = setup()
    const project = await context.propertyService.createProject('user-a', {
      title: 'Mieszkanie testowe',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })

    const response = await context.handlers.createSource(
      jsonRequest('POST', {
        fileName: 'operat.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 12_000,
        checksumSha256: 'a'.repeat(64),
        organizationId: 'forged-organization',
        storageKey: 'public/forged.pdf',
        status: 'completed',
      }),
      propertyContext(project.id),
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toMatchObject({
      source: {
        organizationId: project.organizationId,
        propertyProjectId: project.id,
        status: 'upload_pending',
      },
      upload: {
        method: 'POST',
        url: 'https://upload.example.test',
        expiresAt: '2026-07-27T12:05:00.000Z',
      },
    })
    expect(body.source.storageKey).toBe(
      `originals/organizations/${project.organizationId}/properties/${project.id}/sources/${body.source.id}/original`,
    )
    expect(body.source.storageKey).not.toContain('operat.pdf')
  })

  it.each([
    {
      fileName: 'plik.exe',
      mediaType: 'application/octet-stream',
      sizeBytes: 100,
      checksumSha256: 'a'.repeat(64),
    },
    {
      fileName: 'za-duzy.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 25 * 1024 * 1024 + 1,
      checksumSha256: 'a'.repeat(64),
    },
    {
      fileName: 'zla-suma.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 100,
      checksumSha256: 'not-a-checksum',
    },
  ])('returns 400 for invalid upload metadata: %j', async (body) => {
    const context = setup()
    const project = await context.propertyService.createProject('user-a', {
      title: 'Mieszkanie testowe',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })

    const response = await context.handlers.createSource(
      jsonRequest('POST', body),
      propertyContext(project.id),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'validation_error',
    })
    expect(context.createUploadGrant).not.toHaveBeenCalled()
  })

  it('returns a safe 503 when source storage is unavailable', async () => {
    const context = setup()
    const project = await context.propertyService.createProject('user-a', {
      title: 'Mieszkanie testowe',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })
    context.createUploadGrant.mockRejectedValueOnce(
      new Error(
        'bucket-name signed-policy PropertySourceStorageStack arn:aws:kms:eu-central-1:111122223333:key/private',
      ),
    )

    const response = await context.handlers.createSource(
      jsonRequest('POST', validSourceBody()),
      propertyContext(project.id),
    )
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({ error: 'source_storage_unavailable' })
    expect(JSON.stringify(body)).not.toMatch(
      /bucket-name|signed-policy|PropertySourceStorageStack|arn:aws/,
    )
  })

  it('does not expose a missing AWS runtime identifier', async () => {
    const response = propertySourceErrorResponse(
      new Error('Missing runtime variable: PROPERTY_SOURCE_BUCKET'),
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'source_storage_unavailable',
    })
  })

  it('lists sources for the authenticated tenant', async () => {
    const context = await createProposalContext()

    const response = await context.handlers.listSources(
      new Request(
        `http://localhost/api/properties/${context.project.id}/sources`,
      ),
      propertyContext(context.project.id),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sources).toEqual([
      expect.objectContaining({
        id: context.source.id,
        fileName: 'operat.pdf',
      }),
    ])
  })

  it('filters proposals by review status', async () => {
    const context = await createProposalContext({ existingValue: 80 })

    const conflictResponse = await context.handlers.listProposals(
      new Request(
        `http://localhost/api/properties/${context.project.id}/proposals?status=conflict`,
      ),
      propertyContext(context.project.id),
    )
    const pendingResponse = await context.handlers.listProposals(
      new Request(
        `http://localhost/api/properties/${context.project.id}/proposals?status=pending`,
      ),
      propertyContext(context.project.id),
    )

    await expect(conflictResponse.json()).resolves.toMatchObject({
      proposals: [expect.objectContaining({ id: context.proposal.id })],
    })
    await expect(pendingResponse.json()).resolves.toEqual({ proposals: [] })
  })

  it('returns 400 for invalid status filters and route identifiers', async () => {
    const context = await createProposalContext()

    const filterResponse = await context.handlers.listProposals(
      new Request(
        `http://localhost/api/properties/${context.project.id}/proposals?status=made_up`,
      ),
      propertyContext(context.project.id),
    )
    const idResponse = await context.handlers.listSources(
      new Request('http://localhost/api/properties/not-a-uuid/sources'),
      propertyContext('not-a-uuid'),
    )

    expect(filterResponse.status).toBe(400)
    expect(idResponse.status).toBe(400)
  })

  it('decides a proposal through the authenticated boundary', async () => {
    const context = await createProposalContext()

    const response = await context.handlers.decideProposal(
      jsonRequest('POST', { action: 'accept' }),
      proposalContext(context.project.id, context.proposal.id),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      proposal: { status: 'accepted' },
      fact: {
        status: 'confirmed',
        confirmedByUserId: 'user-a',
      },
    })
  })

  it('returns 400 for invalid JSON without exposing parser internals', async () => {
    const context = await createProposalContext()

    const response = await context.handlers.decideProposal(
      new Request('http://localhost/api/proposals/decision', {
        method: 'POST',
        body: '{invalid-json',
      }),
      proposalContext(context.project.id, context.proposal.id),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'invalid_json' })
  })

  it('returns 404 for cross-tenant proposal access', async () => {
    const context = await createProposalContext()
    const otherHandlers = createPropertySourceHttpHandlers({
      getService: () => context.sourceService,
      getUploadService: () => context.uploadService,
      getUserId: async () => 'user-b',
    })

    const response = await otherHandlers.decideProposal(
      jsonRequest('POST', { action: 'accept' }),
      proposalContext(context.project.id, context.proposal.id),
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'not_found' })
  })

  it('returns 404 for a cross-tenant source download', async () => {
    const context = setup()
    const project = await context.propertyService.createProject('user-a', {
      title: 'Mieszkanie testowe',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })
    const source = await context.sourceService.registerSource(
      'user-a',
      project.id,
      validSourceBody(),
    )
    const otherHandlers = createPropertySourceHttpHandlers({
      getService: () => context.sourceService,
      getUploadService: () => context.uploadService,
      getUserId: async () => 'user-b',
    })

    const response = await otherHandlers.downloadSource(
      new Request('http://localhost/api/source/download'),
      sourceContext(project.id, source.id),
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'not_found' })
    expect(context.createCleanDownloadUrl).not.toHaveBeenCalled()
  })

  it('returns source_not_clean before a source reaches review', async () => {
    const context = setup()
    const project = await context.propertyService.createProject('user-a', {
      title: 'Mieszkanie testowe',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })
    const source = await context.sourceService.registerSource(
      'user-a',
      project.id,
      validSourceBody(),
    )

    const response = await context.handlers.downloadSource(
      new Request('http://localhost/api/source/download'),
      sourceContext(project.id, source.id),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'source_not_clean',
    })
    expect(context.createCleanDownloadUrl).not.toHaveBeenCalled()
  })

  it('returns a sixty-second URL for a review-ready clean source', async () => {
    const context = setup()
    const project = await context.propertyService.createProject('user-a', {
      title: 'Mieszkanie testowe',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })
    const source = await context.sourceService.registerSource(
      'user-a',
      project.id,
      validSourceBody(),
    )
    for (const status of [
      'uploaded',
      'scanning',
      'validating',
      'queued',
      'processing',
      'review_ready',
    ] as const) {
      await context.sourceRepository.updateSourceStatusInternal(source.id, {
        status,
      })
    }

    const response = await context.handlers.downloadSource(
      new Request('http://localhost/api/source/download'),
      sourceContext(project.id, source.id),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      url: 'https://download.example.test',
      expiresAt: '2026-07-27T12:01:00.000Z',
    })
  })

  it('returns 400 for invalid source and property download identifiers', async () => {
    const { handlers } = setup()

    const invalidProperty = await handlers.downloadSource(
      new Request('http://localhost/api/source/download'),
      sourceContext(
        'not-a-property',
        '00000000-0000-4000-8000-000000000001',
      ),
    )
    const invalidSource = await handlers.downloadSource(
      new Request('http://localhost/api/source/download'),
      sourceContext(
        '00000000-0000-4000-8000-000000000001',
        'not-a-source',
      ),
    )

    expect(invalidProperty.status).toBe(400)
    expect(invalidSource.status).toBe(400)
  })

  it('returns 409 when a final proposal receives a different decision', async () => {
    const context = await createProposalContext()
    await context.sourceService.decideProposal(
      'user-a',
      context.project.id,
      context.proposal.id,
      { action: 'accept' },
    )

    const response = await context.handlers.decideProposal(
      jsonRequest('POST', { action: 'reject' }),
      proposalContext(context.project.id, context.proposal.id),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'proposal_already_decided',
    })
  })

  it('uses a generic response for unexpected errors', async () => {
    const response = propertySourceErrorResponse(
      new Error('SELECT secret FROM credentials WHERE DATABASE_URL=hidden'),
    )
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'internal_error' })
    expect(JSON.stringify(body)).not.toContain('secret')
    expect(JSON.stringify(body)).not.toContain('DATABASE_URL')
  })

  async function createProposalContext(
    options: { existingValue?: number } = {},
  ) {
    const context = setup()
    const project = await context.propertyService.createProject('user-a', {
      title: 'Mieszkanie Jeżyce',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })
    const source = await context.sourceService.registerSource(
      'user-a',
      project.id,
      {
        fileName: 'operat.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 12_000,
        checksumSha256: 'a'.repeat(64),
      },
    )
    if (options.existingValue !== undefined) {
      await context.propertyService.createFact('user-a', project.id, {
        key: 'area.usable',
        label: 'Powierzchnia użytkowa',
        category: 'Powierzchnia',
        valueType: 'number',
        value: options.existingValue,
        unit: 'm²',
        status: 'confirmed',
        visibility: 'client',
        sourceIds: ['owner-declaration'],
      })
    }
    const job = await context.sourceService.createProcessingJobInternal({
      sourceId: source.id,
      idempotencyKey: `source:${source.id}:attempt:1`,
      attempt: 1,
    })
    const [proposal] = await context.sourceService.ingestProposalsInternal({
      sourceId: source.id,
      jobId: job.id,
      proposals: [
        {
          externalKey: 'area-usable-1',
          factKey: 'area.usable',
          label: 'Pole modelu',
          category: 'Pole modelu',
          valueType: 'number',
          value: 83.4,
          confidence: 0.98,
          evidenceText: 'Powierzchnia użytkowa: 83,40 m²',
          evidenceLocator: { type: 'page', page: 2 },
        },
      ],
    })

    return { ...context, project, source, proposal }
  }
})

function propertyContext(propertyId: string) {
  return { params: Promise.resolve({ propertyId }) }
}

function proposalContext(propertyId: string, proposalId: string) {
  return { params: Promise.resolve({ propertyId, proposalId }) }
}

function sourceContext(propertyId: string, sourceId: string) {
  return { params: Promise.resolve({ propertyId, sourceId }) }
}

function jsonRequest(method: string, body: unknown) {
  return new Request('http://localhost/api/proposals/decision', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function validSourceBody() {
  return {
    fileName: 'operat.pdf',
    mediaType: 'application/pdf',
    sizeBytes: 12_000,
    checksumSha256: 'a'.repeat(64),
  }
}
