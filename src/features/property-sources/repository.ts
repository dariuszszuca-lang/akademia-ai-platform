import type {
  CreatePropertySourceInput,
  FactProposalStatus,
  IngestFactProposalInput,
  PropertyFactProposal,
  PropertySource,
  PropertySourceStatus,
  ProposalDecision,
  SourceProcessingJob,
} from './domain'
import type { PropertyFact } from '../properties/domain'

export type NewPropertySourceRecord = CreatePropertySourceInput & {
  id: string
  organizationId: string
  propertyProjectId: string
  storageKey: string
  createdByUserId: string
}

export type NewSourceJobRecord = {
  id: string
  organizationId: string
  propertyProjectId: string
  sourceId: string
  idempotencyKey: string
  attempt: number
  modelId: string | null
}

export type TrustedProposalInput = IngestFactProposalInput & {
  status: Extract<FactProposalStatus, 'pending' | 'conflict'>
  conflictsWithFactId: string | null
}

export type ProposalIngestionContext = {
  organizationId: string
  propertyProjectId: string
  sourceId: string
  jobId: string
}

export type IngestedProposal = {
  proposal: PropertyFactProposal
  created: boolean
}

export type ProposalListFilter = {
  statuses?: FactProposalStatus[]
  sourceId?: string
}

export type DecideProposalCommand = {
  userId: string
  organizationId: string
  propertyProjectId: string
  proposalId: string
  decision: ProposalDecision
  decisionFingerprint: string
}

export type ProposalDecisionResult = {
  proposal: PropertyFactProposal
  fact: PropertyFact | null
}

export type PropertySourcesExport = {
  sources: PropertySource[]
  sourceJobs: SourceProcessingJob[]
  factProposals: PropertyFactProposal[]
}

export type SourceStatusUpdate = {
  status: PropertySourceStatus
  errorCode?: string | null
  errorMessage?: string | null
  uploadedAt?: Date | null
  processedAt?: Date | null
}

export interface PropertySourceRepository {
  createSource(record: NewPropertySourceRecord): Promise<PropertySource>
  listSources(
    organizationId: string,
    propertyProjectId: string,
  ): Promise<PropertySource[]>
  getSource(
    organizationId: string,
    propertyProjectId: string,
    sourceId: string,
  ): Promise<PropertySource | null>
  getSourceInternal(sourceId: string): Promise<PropertySource | null>
  updateSourceStatusInternal(
    sourceId: string,
    update: SourceStatusUpdate,
  ): Promise<PropertySource | null>
  createJobInternal(
    record: NewSourceJobRecord,
  ): Promise<SourceProcessingJob>
  getJobInternal(jobId: string): Promise<SourceProcessingJob | null>
  getJobByIdempotencyKeyInternal(
    idempotencyKey: string,
  ): Promise<SourceProcessingJob | null>
  ingestProposalsInternal(
    context: ProposalIngestionContext,
    proposals: TrustedProposalInput[],
  ): Promise<IngestedProposal[]>
  listProposals(
    organizationId: string,
    propertyProjectId: string,
    filter?: ProposalListFilter,
  ): Promise<PropertyFactProposal[]>
  getProposal(
    organizationId: string,
    propertyProjectId: string,
    proposalId: string,
  ): Promise<PropertyFactProposal | null>
  decideProposal(
    command: DecideProposalCommand,
  ): Promise<ProposalDecisionResult>
  exportForUser(userId: string): Promise<PropertySourcesExport>
}
