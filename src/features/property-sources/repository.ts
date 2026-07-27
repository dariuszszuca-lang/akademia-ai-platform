import type {
  CreatePropertySourceInput,
  PropertySource,
} from './domain'

export type NewPropertySourceRecord = CreatePropertySourceInput & {
  id: string
  organizationId: string
  propertyProjectId: string
  storageKey: string
  createdByUserId: string
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
}
