import crypto from 'node:crypto'
import { z } from 'zod'
import type { PropertyRepository } from '../properties/repository'
import { propertyFactsShareSemanticIdentity } from '../properties/fact-identity'
import {
  noopStudioEventSink,
  type StudioEventInput,
  type StudioEventSink,
} from '../studio-events/domain'
import { resolveFactDefinition } from './catalog'
import {
  createPropertySourceSchema,
  factProposalStatuses,
  ingestFactProposalSchema,
  proposalDecisionSchema,
} from './domain'
import type {
  ProposalListFilter,
  PropertySourceRepository,
  TrustedProposalInput,
} from './repository'
import { createPropertySourceStorageKey } from './object-store'
import { propertyFactValuesEqual } from './value-comparison'

const createProcessingJobSchema = z.object({
  sourceId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(240),
  attempt: z.number().int().positive().max(20),
  pipelineVersion: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9._-]{0,79}$/)
    .default('property-source-v1'),
  modelId: z.string().trim().min(1).max(240).optional(),
})

const ingestProposalsCommandSchema = z.object({
  sourceId: z.string().uuid(),
  jobId: z.string().uuid(),
  proposals: z.array(ingestFactProposalSchema).min(1).max(200),
})

const proposalListFilterSchema = z
  .object({
    statuses: z.array(z.enum(factProposalStatuses)).min(1).optional(),
    sourceId: z.string().uuid().optional(),
  })
  .optional()

export class PropertySourceService {
  constructor(
    private readonly propertyRepository: PropertyRepository,
    private readonly sourceRepository: PropertySourceRepository,
    private readonly events: StudioEventSink = noopStudioEventSink,
  ) {}

  async registerSource(
    userId: string,
    propertyProjectId: string,
    rawInput: unknown,
  ) {
    const project = await this.getProject(userId, propertyProjectId)
    const input = createPropertySourceSchema.parse(rawInput)
    const sourceId = crypto.randomUUID()
    const storageKey = createPropertySourceStorageKey({
      organizationId: project.organizationId,
      propertyProjectId: project.id,
      sourceId,
    })

    const source = await this.sourceRepository.createSource({
      ...input,
      id: sourceId,
      organizationId: project.organizationId,
      propertyProjectId: project.id,
      storageKey,
      createdByUserId: userId,
    })

    await this.propertyRepository.appendAudit({
      organizationId: project.organizationId,
      propertyProjectId: project.id,
      actorType: 'user',
      actorId: userId,
      action: 'source.registered',
      entityType: 'property_source',
      entityId: source.id,
      before: null,
      after: source,
    })
    await this.recordStudioEvent({
      organizationId: project.organizationId,
      userId,
      propertyProjectId: project.id,
      name: 'source.registered',
      contractVersion: 'studio-events-v1',
      metadata: { sourceStatus: source.status },
    })

    return source
  }

  async listSources(userId: string, propertyProjectId: string) {
    const project = await this.getProject(userId, propertyProjectId)
    return this.sourceRepository.listSources(
      project.organizationId,
      project.id,
    )
  }

  async getSource(
    userId: string,
    propertyProjectId: string,
    sourceId: string,
  ) {
    const project = await this.getProject(userId, propertyProjectId)
    const source = await this.sourceRepository.getSource(
      project.organizationId,
      project.id,
      sourceId,
    )
    if (!source) throw new Error('SOURCE_NOT_FOUND')
    return source
  }

  async createProcessingJobInternal(rawInput: unknown) {
    const input = createProcessingJobSchema.parse(rawInput)
    const source = await this.sourceRepository.getSourceInternal(input.sourceId)
    if (!source) throw new Error('SOURCE_NOT_FOUND')

    const existing =
      await this.sourceRepository.getJobByIdempotencyKeyInternal(
        input.idempotencyKey,
      )
    if (existing) {
      if (existing.sourceId !== source.id) {
        throw new Error('IDEMPOTENCY_KEY_REUSED')
      }
      return existing
    }

    return this.sourceRepository.createJobInternal({
      id: crypto.randomUUID(),
      organizationId: source.organizationId,
      propertyProjectId: source.propertyProjectId,
      sourceId: source.id,
      idempotencyKey: input.idempotencyKey,
      attempt: input.attempt,
      pipelineVersion: input.pipelineVersion,
      modelId: input.modelId ?? null,
    })
  }

  async ingestProposalsInternal(rawInput: unknown) {
    const input = ingestProposalsCommandSchema.parse(rawInput)
    const source = await this.sourceRepository.getSourceInternal(input.sourceId)
    if (!source) throw new Error('SOURCE_NOT_FOUND')
    const job = await this.sourceRepository.getJobInternal(input.jobId)
    if (!job) throw new Error('JOB_NOT_FOUND')
    if (
      job.sourceId !== source.id ||
      job.organizationId !== source.organizationId ||
      job.propertyProjectId !== source.propertyProjectId
    ) {
      throw new Error('JOB_SOURCE_MISMATCH')
    }

    const project = await this.propertyRepository.getProject(
      source.createdByUserId,
      source.propertyProjectId,
    )
    if (!project || project.organizationId !== source.organizationId) {
      throw new Error('SOURCE_CONTEXT_NOT_FOUND')
    }
    const currentFacts = await this.propertyRepository.listFacts(
      source.createdByUserId,
      source.propertyProjectId,
    )

    const trustedProposals: TrustedProposalInput[] = input.proposals.map(
      (proposal) => {
        const definition = resolveFactDefinition(
          proposal.factKey,
          project.propertyType,
        )
        if (!definition) {
          throw new Error(`UNKNOWN_FACT_KEY:${proposal.factKey}`)
        }

        const canonicalProposal = {
          ...proposal,
          factKey: definition.key,
          label: definition.label,
        }
        const currentFact = currentFacts.find((fact) =>
          propertyFactsShareSemanticIdentity(fact, {
            key: definition.key,
            label: definition.label,
          }),
        )
        const conflict =
          currentFact &&
          !propertyFactValuesEqual(currentFact.value, proposal.value)

        return {
          ...canonicalProposal,
          category: definition.category,
          valueType: definition.valueType,
          unit: definition.unit,
          status: conflict ? 'conflict' : 'pending',
          conflictsWithFactId: conflict ? currentFact.id : null,
        }
      },
    )

    const ingested = await this.sourceRepository.ingestProposalsInternal(
      {
        organizationId: source.organizationId,
        propertyProjectId: source.propertyProjectId,
        sourceId: source.id,
        jobId: job.id,
      },
      trustedProposals,
    )

    for (const result of ingested) {
      if (!result.created) continue

      await this.propertyRepository.appendAudit({
        organizationId: source.organizationId,
        propertyProjectId: source.propertyProjectId,
        actorType: 'ai',
        actorId: job.modelId ?? job.id,
        action: 'proposal.created',
        entityType: 'property_fact_proposal',
        entityId: result.proposal.id,
        before: null,
        after: result.proposal,
      })
    }

    return ingested.map(({ proposal }) => proposal)
  }

  async listProposals(
    userId: string,
    propertyProjectId: string,
    rawFilter?: unknown,
  ) {
    const project = await this.getProject(userId, propertyProjectId)
    const filter = proposalListFilterSchema.parse(
      rawFilter,
    ) as ProposalListFilter | undefined

    return this.sourceRepository.listProposals(
      project.organizationId,
      project.id,
      filter,
    )
  }

  async decideProposal(
    userId: string,
    propertyProjectId: string,
    proposalId: string,
    rawDecision: unknown,
  ) {
    const project = await this.getProject(userId, propertyProjectId)
    const proposal = await this.sourceRepository.getProposal(
      project.organizationId,
      project.id,
      proposalId,
    )
    if (!proposal) throw new Error('PROPOSAL_NOT_FOUND')

    const decision = proposalDecisionSchema.parse(rawDecision)
    const fingerprint = createDecisionFingerprint(userId, decision)

    if (
      !proposal.decisionFingerprint ||
      proposal.decisionFingerprint !== fingerprint
    ) {
      validateDecisionForStatus(proposal.status, decision.action)
    }

    const result = await this.sourceRepository.decideProposal({
      userId,
      organizationId: project.organizationId,
      propertyProjectId: project.id,
      proposalId: proposal.id,
      decision,
      decisionFingerprint: fingerprint,
    })
    if (result.decisionCreated) {
      await this.recordStudioEvent({
        organizationId: project.organizationId,
        userId,
        propertyProjectId: project.id,
        name: 'proposal.decided',
        contractVersion: 'studio-events-v1',
        metadata: {
          proposalStatus: result.proposal.status,
          decisionAction: decision.action,
        },
      })
    }
    return result
  }

  private async getProject(userId: string, propertyProjectId: string) {
    const project = await this.propertyRepository.getProject(
      userId,
      propertyProjectId,
    )
    if (!project) throw new Error('PROPERTY_NOT_FOUND')
    return project
  }

  private async recordStudioEvent(input: StudioEventInput) {
    try {
      await this.events.record(input)
    } catch {
      console.error('studio_event_write_failed')
    }
  }
}

function createDecisionFingerprint(
  userId: string,
  decision: ReturnType<typeof proposalDecisionSchema.parse>,
) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ userId, decision }))
    .digest('hex')
}

function validateDecisionForStatus(
  status: (typeof factProposalStatuses)[number],
  action: ReturnType<typeof proposalDecisionSchema.parse>['action'],
) {
  if (['accepted', 'corrected', 'rejected'].includes(status)) {
    throw new Error('PROPOSAL_ALREADY_DECIDED')
  }

  const isConflict = status === 'conflict' || status === 'needs_review'
  const conflictActions = ['accept_new', 'keep_existing', 'keep_open']

  if (
    (action === 'accept' && isConflict) ||
    (conflictActions.includes(action) && !isConflict)
  ) {
    throw new Error('INVALID_PROPOSAL_DECISION')
  }
}
