import {
  studioEventInputSchema,
  type StudioEventInput,
  type StudioEventSink,
} from './domain'
import type { StudioEventRepository } from './repository'

export class StudioEventService implements StudioEventSink {
  constructor(
    private readonly repository: StudioEventRepository,
  ) {}

  async record(rawInput: StudioEventInput | unknown): Promise<void> {
    const input = studioEventInputSchema.parse(rawInput)
    await this.repository.append(input)
  }

  listForProject(userId: string, propertyProjectId: string) {
    return this.repository.listForProject(
      userId,
      propertyProjectId,
    )
  }

  exportForUser(userId: string) {
    return this.repository.exportForUser(userId)
  }
}
