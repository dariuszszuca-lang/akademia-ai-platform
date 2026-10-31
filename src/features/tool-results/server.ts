import { getPropertyService } from '@/features/properties/server-repository'
import { storeGet, storeSet } from '@/lib/store'
import { createToolResultService } from './service'

export function getToolResultService() {
  return createToolResultService({
    store: { get: storeGet, set: storeSet },
    ownsProperty: async (userId, propertyId) => {
      try {
        const project = await getPropertyService().getProject(userId, propertyId)
        return Boolean(project)
      } catch {
        return false
      }
    },
  })
}
