import crypto from 'node:crypto'
import type { PropertyRepository } from '../properties/repository'
import { createPropertySourceSchema } from './domain'
import type { PropertySourceRepository } from './repository'

export class PropertySourceService {
  constructor(
    private readonly propertyRepository: PropertyRepository,
    private readonly sourceRepository: PropertySourceRepository,
  ) {}

  async registerSource(
    userId: string,
    propertyProjectId: string,
    rawInput: unknown,
  ) {
    const project = await this.getProject(userId, propertyProjectId)
    const input = createPropertySourceSchema.parse(rawInput)
    const sourceId = crypto.randomUUID()
    const storageKey = [
      'organizations',
      project.organizationId,
      'properties',
      project.id,
      'sources',
      sourceId,
      'original',
    ].join('/')

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

  private async getProject(userId: string, propertyProjectId: string) {
    const project = await this.propertyRepository.getProject(
      userId,
      propertyProjectId,
    )
    if (!project) throw new Error('PROPERTY_NOT_FOUND')
    return project
  }
}
