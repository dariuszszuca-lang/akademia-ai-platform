import { randomUUID } from 'node:crypto'
import type { PropertyRepository } from '../properties/repository'
import {
  studioEventInputSchema,
  type StudioEventInput,
  type StudioProductEvent,
} from './domain'
import type { StudioEventRepository } from './repository'

export class MemoryStudioEventRepository
  implements StudioEventRepository
{
  private events: StudioProductEvent[] = []

  constructor(
    private readonly properties: PropertyRepository,
  ) {}

  async append(rawInput: StudioEventInput) {
    const input = studioEventInputSchema.parse(rawInput)
    await this.assertContext(input)
    const event: StudioProductEvent = {
      ...structuredClone(input),
      id: randomUUID(),
      createdAt: new Date(),
    }
    this.events.push(event)
    return structuredClone(event)
  }

  async listForProject(
    userId: string,
    propertyProjectId: string,
  ) {
    const project = await this.properties.getProject(
      userId,
      propertyProjectId,
    )
    if (!project) return []

    return structuredClone(
      this.events
        .filter(
          (event) =>
            event.organizationId === project.organizationId &&
            event.propertyProjectId === propertyProjectId,
        )
        .toSorted(
          (left, right) =>
            right.createdAt.getTime() - left.createdAt.getTime(),
        ),
    )
  }

  async exportForUser(userId: string) {
    const organizationId =
      await this.properties.getOrCreatePersonalOrganization(userId)
    return structuredClone(
      this.events
        .filter(
          (event) => event.organizationId === organizationId,
        )
        .toSorted(
          (left, right) =>
            left.createdAt.getTime() - right.createdAt.getTime(),
        ),
    )
  }

  private async assertContext(input: StudioEventInput) {
    if (input.propertyProjectId) {
      const project = await this.properties.getProject(
        input.userId,
        input.propertyProjectId,
      )
      if (
        !project ||
        project.organizationId !== input.organizationId
      ) {
        throw new Error('STUDIO_EVENT_CONTEXT_MISMATCH')
      }
      return
    }

    const organizationId =
      await this.properties.getOrCreatePersonalOrganization(input.userId)
    if (organizationId !== input.organizationId) {
      throw new Error('STUDIO_EVENT_CONTEXT_MISMATCH')
    }
  }
}
