import type { PropertyRepository } from '../properties/repository'
import type {
  NewPropertySourceRecord,
  PropertySourceRepository,
} from './repository'
import type { PropertySource } from './domain'

export class MemoryPropertySourceRepository
  implements PropertySourceRepository
{
  private sources: PropertySource[] = []

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
}

function clone<T>(value: T): T {
  return structuredClone(value)
}
