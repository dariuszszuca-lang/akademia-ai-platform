import type {
  StudioEventInput,
  StudioProductEvent,
} from './domain'

export interface StudioEventRepository {
  append(input: StudioEventInput): Promise<StudioProductEvent>
  listForProject(
    userId: string,
    propertyProjectId: string,
  ): Promise<StudioProductEvent[]>
  exportForUser(userId: string): Promise<StudioProductEvent[]>
}
