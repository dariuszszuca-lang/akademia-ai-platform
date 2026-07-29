import {
  createPropertyFactSchema,
  createPropertySchema,
  updatePropertyFactSchema,
  updatePropertySchema,
} from './domain'
import { ZodError } from 'zod'
import type { PropertyRepository } from './repository'
import { validateCatalogFactMetadata } from '../property-sources/catalog'
import {
  noopStudioEventSink,
  type StudioEventInput,
  type StudioEventSink,
} from '../studio-events/domain'

export class PropertyService {
  constructor(
    private readonly repository: PropertyRepository,
    private readonly events: StudioEventSink = noopStudioEventSink,
  ) {}

  listProjects(userId: string) {
    return this.repository.listProjects(userId)
  }

  async recordSessionStarted(userId: string) {
    const organizationId =
      await this.repository.getOrCreatePersonalOrganization(userId)
    await this.recordStudioEvent({
      organizationId,
      userId,
      name: 'studio.session_started',
      contractVersion: 'studio-events-v1',
      metadata: {},
    })
  }

  async recordPropertyOpened(userId: string, projectId: string) {
    const project = await this.getProject(userId, projectId)
    await this.recordStudioEvent({
      organizationId: project.organizationId,
      userId,
      propertyProjectId: project.id,
      name: 'property.opened',
      contractVersion: 'studio-events-v1',
      metadata: propertyMetadata(project),
    })
  }

  async getProject(userId: string, projectId: string) {
    const project = await this.repository.getProject(userId, projectId)
    if (!project) throw new Error('PROPERTY_NOT_FOUND')
    return project
  }

  async createProject(userId: string, rawInput: unknown) {
    const input = createPropertySchema.parse(rawInput)
    const organizationId =
      await this.repository.getOrCreatePersonalOrganization(userId)
    const project = await this.repository.createProject(
      userId,
      organizationId,
      input,
    )

    await this.repository.appendAudit({
      organizationId,
      propertyProjectId: project.id,
      actorType: 'user',
      actorId: userId,
      action: 'property.created',
      entityType: 'property',
      entityId: project.id,
      before: null,
      after: project,
    })
    await this.recordStudioEvent({
      organizationId,
      userId,
      propertyProjectId: project.id,
      name: 'property.created',
      contractVersion: 'studio-events-v1',
      metadata: propertyMetadata(project),
    })

    return project
  }

  async updateProject(userId: string, projectId: string, rawInput: unknown) {
    const before = await this.getProject(userId, projectId)
    const input = updatePropertySchema.parse(rawInput)
    const updated = await this.repository.updateProject(
      userId,
      projectId,
      input,
    )
    if (!updated) throw new Error('PROPERTY_NOT_FOUND')

    await this.repository.appendAudit({
      organizationId: before.organizationId,
      propertyProjectId: projectId,
      actorType: 'user',
      actorId: userId,
      action: 'property.updated',
      entityType: 'property',
      entityId: projectId,
      before,
      after: updated,
    })
    if (before.stage !== 'ready' && updated.stage === 'ready') {
      await this.recordStudioEvent({
        organizationId: updated.organizationId,
        userId,
        propertyProjectId: updated.id,
        name: 'property.ready_reached',
        contractVersion: 'studio-events-v1',
        metadata: propertyMetadata(updated),
      })
    }

    return updated
  }

  async listFacts(userId: string, projectId: string) {
    await this.getProject(userId, projectId)
    return this.repository.listFacts(userId, projectId)
  }

  async listAudit(userId: string, projectId: string) {
    await this.getProject(userId, projectId)
    return this.repository.listAudit(userId, projectId)
  }

  async createFact(userId: string, projectId: string, rawInput: unknown) {
    const project = await this.getProject(userId, projectId)
    const input = createPropertyFactSchema.parse(
      normalizeCreateFactInput(rawInput, userId),
    )
    const catalogIssues = validateCatalogFactMetadata(
      input,
      project.propertyType,
    )
    if (catalogIssues.length > 0) {
      throw new ZodError(
        catalogIssues.map((issue) => ({
          code: 'custom',
          path: [issue.path],
          message: issue.message,
        })),
      )
    }

    const fact = await this.repository.createFact(userId, projectId, input)
    if (!fact) throw new Error('PROPERTY_NOT_FOUND')

    await this.repository.appendAudit({
      organizationId: project.organizationId,
      propertyProjectId: projectId,
      actorType: 'user',
      actorId: userId,
      action: 'fact.created',
      entityType: 'property_fact',
      entityId: fact.id,
      before: null,
      after: fact,
    })
    await this.recordStudioEvent({
      organizationId: project.organizationId,
      userId,
      propertyProjectId: projectId,
      name: 'fact.created',
      contractVersion: 'studio-events-v1',
      metadata: { factStatus: fact.status },
    })

    return fact
  }

  async updateFact(
    userId: string,
    projectId: string,
    factId: string,
    rawInput: unknown,
  ) {
    const project = await this.getProject(userId, projectId)
    const before = await this.repository.getFact(userId, projectId, factId)
    if (!before) throw new Error('FACT_NOT_FOUND')

    const input = updatePropertyFactSchema.parse(
      normalizeUpdateFactInput(rawInput, userId),
    )
    const updated = await this.repository.updateFact(
      userId,
      projectId,
      factId,
      input,
    )
    if (!updated) throw new Error('FACT_NOT_FOUND')

    await this.repository.appendAudit({
      organizationId: project.organizationId,
      propertyProjectId: projectId,
      actorType: 'user',
      actorId: userId,
      action: 'fact.updated',
      entityType: 'property_fact',
      entityId: factId,
      before,
      after: updated,
    })
    await this.recordStudioEvent({
      organizationId: project.organizationId,
      userId,
      propertyProjectId: projectId,
      name: 'fact.updated',
      contractVersion: 'studio-events-v1',
      metadata: { factStatus: updated.status },
    })

    return updated
  }

  private async recordStudioEvent(input: StudioEventInput) {
    try {
      await this.events.record(input)
    } catch {
      console.error('studio_event_write_failed')
    }
  }
}

function propertyMetadata(project: {
  propertyType: string
  transactionType: string
  stage: string
}) {
  return {
    propertyType: project.propertyType,
    transactionType: project.transactionType,
    stage: project.stage,
  }
}

function normalizeCreateFactInput(rawInput: unknown, userId: string) {
  if (!isRecord(rawInput)) return rawInput

  const {
    actorType: _actorType,
    confirmedByUserId: _confirmedByUserId,
    ...safeInput
  } = rawInput
  void _actorType
  void _confirmedByUserId

  return {
    ...safeInput,
    ...(safeInput.status === 'confirmed'
      ? { confirmedByUserId: userId }
      : {}),
  }
}

function normalizeUpdateFactInput(rawInput: unknown, userId: string) {
  if (!isRecord(rawInput)) {
    return { actorType: 'user' }
  }

  const {
    actorType: _actorType,
    confirmedByUserId: _confirmedByUserId,
    ...safeInput
  } = rawInput
  void _actorType
  void _confirmedByUserId

  return {
    ...safeInput,
    actorType: 'user',
    ...(safeInput.status === 'confirmed'
      ? { confirmedByUserId: userId }
      : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
