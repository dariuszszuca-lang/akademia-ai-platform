import crypto from 'node:crypto'
import type { PropertyRepository } from '../properties/repository'
import type {
  NewSourceJobRecord,
  NewPropertySourceRecord,
  ProposalIngestionContext,
  ProposalListFilter,
  PropertySourceRepository,
  TrustedProposalInput,
} from './repository'
import type {
  PropertyFactProposal,
  PropertySource,
  SourceProcessingJob,
} from './domain'

export class MemoryPropertySourceRepository
  implements PropertySourceRepository
{
  private sources: PropertySource[] = []
  private jobs: SourceProcessingJob[] = []
  private proposals: PropertyFactProposal[] = []

  constructor(propertyRepository: PropertyRepository) {
    void propertyRepository
  }

  async createSource(record: NewPropertySourceRecord) {
    const now = new Date()
    const source: PropertySource = {
      ...record,
      status: 'upload_pending',
      errorCode: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    }

    this.sources.push(source)
    return clone(source)
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

  async createJobInternal(record: NewSourceJobRecord) {
    const existing = this.jobs.find(
      (job) => job.idempotencyKey === record.idempotencyKey,
    )
    if (existing) return clone(existing)

    const now = new Date()
    const job: SourceProcessingJob = {
      ...record,
      status: 'queued',
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: null,
      errorCode: null,
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
}

function clone<T>(value: T): T {
  return structuredClone(value)
}
