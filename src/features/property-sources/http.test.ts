import { describe, expect, it } from 'vitest'
import { MemoryPropertyRepository } from '../properties/memory-repository'
import { PropertyService } from '../properties/service'
import {
  createPropertySourceHttpHandlers,
  propertySourceErrorResponse,
} from './http'
import { MemoryPropertySourceRepository } from './memory-repository'
import { PropertySourceService } from './service'

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
  const handlers = createPropertySourceHttpHandlers({
    getService: () => sourceService,
    getUserId: async () => userId,
  })

  return { handlers, propertyService, sourceService }
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
      getUserId: async () => 'user-b',
    })

    const response = await otherHandlers.decideProposal(
      jsonRequest('POST', { action: 'accept' }),
      proposalContext(context.project.id, context.proposal.id),
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'not_found' })
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

function jsonRequest(method: string, body: unknown) {
  return new Request('http://localhost/api/proposals/decision', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}
