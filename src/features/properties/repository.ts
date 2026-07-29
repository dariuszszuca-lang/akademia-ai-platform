import type {
  CreatePropertyFactInput,
  CreatePropertyInput,
  PropertyFact,
  PropertyProject,
  UpdatePropertyFactInput,
  UpdatePropertyInput,
} from './domain'

export type AuditRecord = {
  id: string
  organizationId: string
  propertyProjectId: string | null
  actorType: 'user' | 'ai' | 'integration'
  actorId: string
  action: string
  entityType: string
  entityId: string
  before: unknown
  after: unknown
  createdAt: Date
}

export interface PropertyRepository {
  getOrCreatePersonalOrganization(userId: string): Promise<string>
  listProjects(userId: string): Promise<PropertyProject[]>
  getProject(userId: string, projectId: string): Promise<PropertyProject | null>
  createProject(
    userId: string,
    organizationId: string,
    input: CreatePropertyInput,
  ): Promise<PropertyProject>
  updateProject(
    userId: string,
    projectId: string,
    input: UpdatePropertyInput,
  ): Promise<PropertyProject | null>
  listFacts(userId: string, projectId: string): Promise<PropertyFact[]>
  getFact(
    userId: string,
    projectId: string,
    factId: string,
  ): Promise<PropertyFact | null>
  createFact(
    userId: string,
    projectId: string,
    input: CreatePropertyFactInput,
  ): Promise<PropertyFact | null>
  createFactWithAudit(
    userId: string,
    projectId: string,
    input: CreatePropertyFactInput,
  ): Promise<PropertyFact | null>
  updateFact(
    userId: string,
    projectId: string,
    factId: string,
    input: UpdatePropertyFactInput,
  ): Promise<PropertyFact | null>
  updateFactWithAudit(
    userId: string,
    projectId: string,
    factId: string,
    input: UpdatePropertyFactInput,
  ): Promise<PropertyFact | null>
  listAudit(userId: string, projectId: string): Promise<AuditRecord[]>
  appendAudit(record: Omit<AuditRecord, 'id' | 'createdAt'>): Promise<void>
  exportForUser(userId: string): Promise<{
    projects: PropertyProject[]
    facts: PropertyFact[]
    audit: AuditRecord[]
  }>
  deleteForUser(userId: string): Promise<void>
}
