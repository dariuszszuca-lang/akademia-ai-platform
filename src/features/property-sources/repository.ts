import type {
  CreatePropertySourceInput,
  FactProposalStatus,
  IngestFactProposalInput,
  PropertyFactProposal,
  PropertySource,
  SourceProcessingJob,
} from './domain'

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
}
