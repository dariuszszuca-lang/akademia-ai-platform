import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PostgresPropertyRepository } from '../properties/postgres-repository'
import { PropertyService } from '../properties/service'
import type { PropertyFactProposal } from './domain'
import { PostgresPropertySourceRepository } from './postgres-repository'
import { PropertySourceService } from './service'

describe('PostgresPropertySourceRepository', () => {
  let client: PGlite
  let propertyRepository: PostgresPropertyRepository
  let sourceRepository: PostgresPropertySourceRepository
  let propertyService: PropertyService
  let sourceService: PropertySourceService

  beforeEach(async () => {
    client = new PGlite()
    const database = drizzle(client)
    await migrate(database, { migrationsFolder: './drizzle' })
    propertyRepository = new PostgresPropertyRepository(database)
    sourceRepository = new PostgresPropertySourceRepository(database)
    propertyService = new PropertyService(propertyRepository)
    sourceService = new PropertySourceService(
      propertyRepository,
      sourceRepository,
    )
  })

  afterEach(async () => {
    await client.close()
  })

  it('persists sources and scopes reads by tenant and property', async () => {
    const context = await createContext()

    expect(
      await sourceRepository.getSource(
        context.project.organizationId,
        context.project.id,
        context.source.id,
      ),
    ).toEqual(context.source)
    expect(
      await sourceRepository.listSources(
        '00000000-0000-4000-8000-000000000000',
        context.project.id,
      ),
    ).toEqual([])
    await expect(
      sourceService.listSources('user-b', context.project.id),
    ).rejects.toThrow('PROPERTY_NOT_FOUND')
  })

  it('creates jobs and proposals idempotently', async () => {
    const { source, job, proposal } = await createContext()
    const repeatedJob = await sourceService.createProcessingJobInternal({
      sourceId: source.id,
      idempotencyKey: job.idempotencyKey,
      attempt: 1,
      modelId: 'test-model',
    })
    const [repeatedProposal] =
      await sourceService.ingestProposalsInternal({
        sourceId: source.id,
        jobId: job.id,
        proposals: [proposalInput()],
      })

    expect(repeatedJob).toEqual(job)
    expect(repeatedProposal).toEqual(proposal)
    expect(
      await sourceRepository.listProposals(
        source.organizationId,
        source.propertyProjectId,
      ),
    ).toHaveLength(1)
  })

  it('detects a conflict against the current fact', async () => {
    const { currentFact, proposal } = await createContext({
      existingValue: 80,
    })

    expect(proposal).toMatchObject({
      status: 'conflict',
      conflictsWithFactId: currentFact?.id,
    })
    expect(currentFact?.value).toBe(80)
  })

  it('accepts and corrects pending proposals transactionally', async () => {
    const accepted = await createContext()
    const acceptedResult = await sourceService.decideProposal(
      'user-a',
      accepted.project.id,
      accepted.proposal.id,
      { action: 'accept' },
    )
    const corrected = await createContext()
    const correctedResult = await sourceService.decideProposal(
      'user-a',
      corrected.project.id,
      corrected.proposal.id,
      { action: 'correct_and_accept', value: 82.9 },
    )

    expect(acceptedResult.proposal.status).toBe('accepted')
    expect(acceptedResult.fact).toMatchObject({
      value: 83.4,
      status: 'confirmed',
      confirmedByUserId: 'user-a',
      sourceIds: [accepted.source.id],
    })
    expect(correctedResult.proposal.status).toBe('corrected')
    expect(correctedResult.fact?.value).toBe(82.9)
  })

  it('rejects a pending proposal without writing a fact', async () => {
    const context = await createContext()

    const result = await sourceService.decideProposal(
      'user-a',
      context.project.id,
      context.proposal.id,
      { action: 'reject', note: 'Nieaktualny dokument.' },
    )

    expect(result.proposal.status).toBe('rejected')
    expect(result.fact).toBeNull()
    expect(
      await propertyService.listFacts('user-a', context.project.id),
    ).toEqual([])
  })

  it.each([
    {
      action: 'keep_existing' as const,
      proposalStatus: 'rejected',
      factValue: 80,
      factStatus: 'confirmed',
      factVersion: 1,
    },
    {
      action: 'accept_new' as const,
      proposalStatus: 'accepted',
      factValue: 83.4,
      factStatus: 'confirmed',
      factVersion: 2,
    },
    {
      action: 'keep_open' as const,
      proposalStatus: 'needs_review',
      factValue: 80,
      factStatus: 'conflicting',
      factVersion: 2,
    },
  ])(
    'resolves a conflict with $action',
    async ({
      action,
      proposalStatus,
      factValue,
      factStatus,
      factVersion,
    }) => {
      const context = await createContext({ existingValue: 80 })

      const result = await sourceService.decideProposal(
        'user-a',
        context.project.id,
        context.proposal.id,
        { action },
      )

      expect(result.proposal.status).toBe(proposalStatus)
      expect(result.fact).toMatchObject({
        value: factValue,
        status: factStatus,
        version: factVersion,
      })
    },
  )

  it('rolls back fact and proposal changes when audit persistence fails', async () => {
    const context = await createContext()
    await client.exec('DROP TABLE property_audit_events')

    await expect(
      sourceService.decideProposal(
        'user-a',
        context.project.id,
        context.proposal.id,
        { action: 'accept' },
      ),
    ).rejects.toThrow()

    expect(
      await sourceRepository.getProposal(
        context.project.organizationId,
        context.project.id,
        context.proposal.id,
      ),
    ).toMatchObject({ status: 'pending', decidedAt: null })
    expect(
      await propertyRepository.listFacts('user-a', context.project.id),
    ).toEqual([])
  })

  it('allows one winner for concurrent final decisions', async () => {
    const context = await createContext()

    const results = await Promise.allSettled([
      sourceService.decideProposal(
        'user-a',
        context.project.id,
        context.proposal.id,
        { action: 'accept' },
      ),
      sourceService.decideProposal(
        'user-a',
        context.project.id,
        context.proposal.id,
        { action: 'reject' },
      ),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(
      1,
    )
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(
      1,
    )
  })

  it('cascades source, job and proposal rows with account deletion', async () => {
    const context = await createContext()

    await propertyRepository.deleteForUser('user-a')

    expect(
      await sourceRepository.getSourceInternal(context.source.id),
    ).toBeNull()
    expect(await sourceRepository.getJobInternal(context.job.id)).toBeNull()
    expect(
      await sourceRepository.getProposal(
        context.project.organizationId,
        context.project.id,
        context.proposal.id,
      ),
    ).toBeNull()
  })

  it('exports source evidence only for the requested user', async () => {
    const userA = await createContext({ userId: 'user-a' })
    await createContext({ userId: 'user-b' })

    const exported = await sourceRepository.exportForUser('user-a')

    expect(exported.sources.map((source) => source.id)).toEqual([
      userA.source.id,
    ])
    expect(exported.sourceJobs.map((job) => job.id)).toEqual([userA.job.id])
    expect(
      exported.factProposals.map((proposal) => proposal.id),
    ).toEqual([userA.proposal.id])
    expect(exported.factProposals[0].evidenceText).toBe(
      'Powierzchnia użytkowa: 83,40 m²',
    )
  })

  async function createContext(
    options: { existingValue?: number; userId?: string } = {},
  ) {
    const userId = options.userId ?? 'user-a'
    const project = await propertyService.createProject(userId, {
      title: `Mieszkanie Jeżyce ${crypto.randomUUID()}`,
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })
    const source = await sourceService.registerSource(userId, project.id, {
      fileName: 'operat.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 12_000,
      checksumSha256: 'a'.repeat(64),
    })
    const job = await sourceService.createProcessingJobInternal({
      sourceId: source.id,
      idempotencyKey: `source:${source.id}:attempt:1`,
      attempt: 1,
      modelId: 'test-model',
    })
    const currentFact =
      options.existingValue === undefined
        ? null
        : await propertyService.createFact(userId, project.id, {
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
    const [proposal] = (await sourceService.ingestProposalsInternal({
      sourceId: source.id,
      jobId: job.id,
      proposals: [proposalInput()],
    })) as [PropertyFactProposal]

    return { project, source, job, currentFact, proposal }
  }
})

function proposalInput() {
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
  }
}
