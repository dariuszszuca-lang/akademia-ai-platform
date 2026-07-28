import type { PropertySource } from './domain'

export interface PropertySourceObjectPurger {
  purgeSources(sources: PropertySource[]): Promise<{
    deletedVersions: number
  }>
}
