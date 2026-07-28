import crypto from 'node:crypto'
import type { PropertyFact } from '../properties/domain'
import type { PropertyRepository } from '../properties/repository'
import type {
  DecideProposalCommand,
  ClaimCallbackNonceCommand,
  NewSourceJobRecord,
  NewPropertySourceRecord,
  ProposalIngestionContext,
  ProposalListFilter,
  PropertySourceRepository,
  SourceStatusUpdate,
  SourceJobUpdate,
  TrustedProposalInput,
} from './repository'
import type {
  PropertyFactProposal,
  PropertySource,
  SourceProcessingJob,
} from './domain'
import { canTransitionSourceStatus } from './source-lifecycle'
import { canTransitionSourceJobStatus } from './job-lifecycle'
import { propertyFactValuesEqual } from './value-comparison'
import { assertCallbackNonceHash } from './callback-auth'

export class MemoryPropertySourceRepository
  implements PropertySourceRepository
{
  private sources: PropertySource[] = []
  private jobs: SourceProcessingJob[] = []
  private callbackNonces = new Set<string>()
  private proposals: PropertyFactProposal[] = []
  private decisionFactSnapshots = new Map<string, PropertyFact | null>()

  constructor(private readonly propertyRepository: PropertyRepository) {}

  async createSource(record: NewPropertySourceRecord) {
    const now = new Date()
    const source: PropertySource = {
      ...record,
      status: 'upload_pending',
      errorCode: null,
      errorMessage: null,
      uploadedAt: null,
      processedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    this.sources.push(source)
    return clone(source)
  }

  async listSourcesForUser(userId: string) {
    const sources: PropertySource[] = []
    for (const source of this.sources) {
      const project = await this.propertyRepository.getProject(
        userId,
        source.propertyProjectId,
      )
      if (
        project &&
        project.organizationId === source.organizationId
      ) {
        sources.push(clone(source))
      }
    }
    return sources
  }

  async listSources(
    organizationId: string,
    propertyProjectId: string,
  ) {
    return clone(
      this.sources
        .filter(
          (source) =>
            source.organizationId === organizationId &&
            source.propertyProjectId === propertyProjectId,
        )
        .reverse(),
    )
  }

  async getSource(
    organizationId: string,
    propertyProjectId: string,
    sourceId: string,
  ) {
    const source = this.sources.find(
      (candidate) =>
        candidate.id === sourceId &&
        candidate.organizationId === organizationId &&
        candidate.propertyProjectId === propertyProjectId,
    )

    return source ? clone(source) : null
  }

  async getSourceInternal(sourceId: string) {
    const source = this.sources.find((candidate) => candidate.id === sourceId)
    return source ? clone(source) : null
  }

  async updateSourceStatusInternal(
    sourceId: string,
    update: SourceStatusUpdate,
  ) {
    const source = this.sources.find((candidate) => candidate.id === sourceId)
    if (!source) return null
    if (!canTransitionSourceStatus(source.status, update.status)) {
      throw new Error('INVALID_SOURCE_STATUS_TRANSITION')
    }

    source.status = update.status
    if (update.errorCode !== undefined) {
      source.errorCode = update.errorCode
    }
    if (update.errorMessage !== undefined) {
      source.errorMessage = update.errorMessage
    }
    if (update.uploadedAt !== undefined) {
      source.uploadedAt = update.uploadedAt
    }
    if (update.processedAt !== undefined) {
      source.processedAt = update.processedAt
    }
    source.updatedAt = new Date()

    return clone(source)
  }

  async createJobInternal(record: NewSourceJobRecord) {
    const existing = this.jobs.find(
      (job) => job.idempotencyKey === record.idempotencyKey,
    )
    if (existing) return clone(existing)

    const now = new Date()
    const job: SourceProcessingJob = {
      ...record,
      status: 'queued',
      provider: null,
      inputTokens: null,
      outputTokens: null,
      durationMs: null,
      estimatedCostUsd: null,
      providerCostMicrounits: null,
      currency: null,
      errorCode: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    this.jobs.push(job)
    return clone(job)
  }

  async getJobInternal(jobId: string) {
    const job = this.jobs.find((candidate) => candidate.id === jobId)
    return job ? clone(job) : null
  }

  async getJobByIdempotencyKeyInternal(idempotencyKey: string) {
    const job = this.jobs.find(
      (candidate) => candidate.idempotencyKey === idempotencyKey,
    )
    return job ? clone(job) : null
  }

  async updateJobInternal(jobId: string, update: SourceJobUpdate) {
    const job = this.jobs.find((candidate) => candidate.id === jobId)
    if (!job) return null
    if (!canTransitionSourceJobStatus(job.status, update.status)) {
      throw new Error('INVALID_JOB_STATUS_TRANSITION')
    }

    job.status = update.status
    for (const field of [
      'pipelineVersion',
      'provider',
      'modelId',
      'inputTokens',
      'outputTokens',
      'durationMs',
      'estimatedCostUsd',
      'providerCostMicrounits',
      'currency',
      'errorCode',
      'errorMessage',
      'startedAt',
      'completedAt',
    ] as const) {
      if (update[field] !== undefined) {
        Object.assign(job, { [field]: update[field] })
      }
    }
    job.updatedAt = new Date()

    return clone(job)
  }

  async claimCallbackNonceInternal(command: ClaimCallbackNonceCommand) {
    assertCallbackNonceHash(command.nonceHash)
    if (this.callbackNonces.has(command.nonceHash)) {
      throw new Error('CALLBACK_REPLAYED')
    }
    const job = this.jobs.find((candidate) => candidate.id === command.jobId)
    if (!job) throw new Error('JOB_NOT_FOUND')
    this.callbackNonces.add(command.nonceHash)
  }

  async ingestProposalsInternal(
    context: ProposalIngestionContext,
    proposals: TrustedProposalInput[],
  ) {
    return proposals.map((input) => {
      const existing = this.proposals.find(
        (proposal) =>
          proposal.jobId === context.jobId &&
          proposal.externalKey === input.externalKey,
      )
      if (existing) {
        return { proposal: clone(existing), created: false }
      }

      const now = new Date()
      const proposal: PropertyFactProposal = {
        ...input,
        id: crypto.randomUUID(),
        ...context,
        decidedByUserId: null,
        decisionNote: null,
        decision: null,
        decisionFingerprint: null,
        decidedAt: null,
        createdAt: now,
        updatedAt: now,
      }
      this.proposals.push(proposal)

      return { proposal: clone(proposal), created: true }
    })
  }

  async listProposals(
    organizationId: string,
    propertyProjectId: string,
    filter: ProposalListFilter = {},
  ) {
    return clone(
      this.proposals
        .filter(
          (proposal) =>
            proposal.organizationId === organizationId &&
            proposal.propertyProjectId === propertyProjectId &&
            (!filter.sourceId || proposal.sourceId === filter.sourceId) &&
            (!filter.statuses ||
              filter.statuses.includes(proposal.status)),
        )
        .reverse(),
    )
  }

  async getProposal(
    organizationId: string,
    propertyProjectId: string,
    proposalId: string,
  ) {
    const proposal = this.proposals.find(
      (candidate) =>
        candidate.id === proposalId &&
        candidate.organizationId === organizationId &&
        candidate.propertyProjectId === propertyProjectId,
    )
    return proposal ? clone(proposal) : null
  }

  async decideProposal(command: DecideProposalCommand) {
    const proposal = this.proposals.find(
      (candidate) =>
        candidate.id === command.proposalId &&
        candidate.organizationId === command.organizationId &&
        candidate.propertyProjectId === command.propertyProjectId,
    )
    if (!proposal) throw new Error('PROPOSAL_NOT_FOUND')

    if (proposal.decisionFingerprint === command.decisionFingerprint) {
      return {
        proposal: clone(proposal),
        fact: this.getDecisionFactSnapshot(
          proposal.id,
          command.decisionFingerprint,
        ),
        decisionCreated: false,
      }
    }

    if (isFinalProposalStatus(proposal.status)) {
      throw new Error('PROPOSAL_ALREADY_DECIDED')
    }

    const facts = await this.propertyRepository.listFacts(
      command.userId,
      command.propertyProjectId,
    )
    const currentFact = facts.find((fact) => fact.key === proposal.factKey)
    const before = clone(proposal)
    const sourceIds = Array.from(
      new Set([...(currentFact?.sourceIds ?? []), proposal.sourceId]),
    )
    let fact = null

    if (
      proposal.status === 'pending' &&
      command.decision.action === 'accept' &&
      currentFact &&
      !propertyFactValuesEqual(currentFact.value, proposal.value)
    ) {
      proposal.status = 'conflict'
      proposal.conflictsWithFactId = currentFact.id
      proposal.updatedAt = new Date()
      await this.propertyRepository.appendAudit({
        organizationId: command.organizationId,
        propertyProjectId: command.propertyProjectId,
        actorType: 'user',
        actorId: command.userId,
        action: 'proposal.conflict_detected',
        entityType: 'property_fact_proposal',
        entityId: proposal.id,
        before,
        after: clone(proposal),
      })
      throw new Error('PROPOSAL_CONFLICT_CHANGED')
    }

    switch (command.decision.action) {
      case 'accept':
      case 'accept_new':
      case 'correct_and_accept': {
        const value =
          command.decision.action === 'correct_and_accept'
            ? command.decision.value
            : proposal.value

        fact = currentFact
          ? await this.propertyRepository.updateFact(
              command.userId,
              command.propertyProjectId,
              currentFact.id,
              {
                label: proposal.label,
                category: proposal.category,
                valueType: proposal.valueType,
                value,
                unit: proposal.unit,
                status: 'confirmed',
                visibility: currentFact.visibility,
                sourceIds,
                confirmedByUserId: command.userId,
                actorType: 'user',
              },
            )
          : await this.propertyRepository.createFact(
              command.userId,
              command.propertyProjectId,
              {
                key: proposal.factKey,
                label: proposal.label,
                category: proposal.category,
                valueType: proposal.valueType,
                value,
                unit: proposal.unit,
                status: 'confirmed',
                visibility: 'internal',
                sourceIds,
                confirmedByUserId: command.userId,
              },
            )
        if (!fact) throw new Error('FACT_WRITE_FAILED')
        proposal.status =
          command.decision.action === 'correct_and_accept'
            ? 'corrected'
            : 'accepted'
        break
      }
      case 'reject':
        proposal.status = 'rejected'
        break
      case 'keep_existing':
        if (!currentFact) throw new Error('PROPOSAL_CONFLICT_CHANGED')
        fact = currentFact
        proposal.status = 'rejected'
        break
      case 'keep_open':
        if (!currentFact) throw new Error('PROPOSAL_CONFLICT_CHANGED')
        fact = await this.propertyRepository.updateFact(
          command.userId,
          command.propertyProjectId,
          currentFact.id,
          {
            status: 'conflicting',
            sourceIds,
            actorType: 'user',
          },
        )
        if (!fact) throw new Error('FACT_WRITE_FAILED')
        proposal.status = 'needs_review'
        break
    }

    const decidedAt = new Date()
    proposal.decidedByUserId = command.userId
    proposal.decisionNote =
      'note' in command.decision ? (command.decision.note ?? null) : null
    proposal.decision = clone(command.decision)
    proposal.decisionFingerprint = command.decisionFingerprint
    proposal.decidedAt = decidedAt
    proposal.updatedAt = decidedAt
    this.decisionFactSnapshots.set(
      decisionSnapshotKey(proposal.id, command.decisionFingerprint),
      fact ? clone(fact) : null,
    )

    await this.propertyRepository.appendAudit({
      organizationId: command.organizationId,
      propertyProjectId: command.propertyProjectId,
      actorType: 'user',
      actorId: command.userId,
      action: 'proposal.decided',
      entityType: 'property_fact_proposal',
      entityId: proposal.id,
      before,
      after: { proposal: clone(proposal), fact },
    })

    return {
      proposal: clone(proposal),
      fact: fact ? clone(fact) : null,
      decisionCreated: true,
    }
  }

  private getDecisionFactSnapshot(
    proposalId: string,
    decisionFingerprint: string,
  ) {
    const snapshot = this.decisionFactSnapshots.get(
      decisionSnapshotKey(proposalId, decisionFingerprint),
    )
    return snapshot ? clone(snapshot) : null
  }

  async exportForUser(userId: string) {
    const propertyExport = await this.propertyRepository.exportForUser(userId)
    const projectIds = new Set(
      propertyExport.projects.map((project) => project.id),
    )
    const organizationIds = new Set(
      propertyExport.projects.map((project) => project.organizationId),
    )

    return clone({
      sources: this.sources.filter(
        (source) =>
          organizationIds.has(source.organizationId) &&
          projectIds.has(source.propertyProjectId),
      ),
      sourceJobs: this.jobs.filter(
        (job) =>
          organizationIds.has(job.organizationId) &&
          projectIds.has(job.propertyProjectId),
      ),
      factProposals: this.proposals.filter(
        (proposal) =>
          organizationIds.has(proposal.organizationId) &&
          projectIds.has(proposal.propertyProjectId),
      ),
    })
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function isFinalProposalStatus(status: PropertyFactProposal['status']) {
  return ['accepted', 'corrected', 'rejected'].includes(status)
}

function decisionSnapshotKey(proposalId: string, fingerprint: string) {
  return `${proposalId}:${fingerprint}`
}
