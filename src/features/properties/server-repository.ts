import 'server-only'
import { getDb } from '@/lib/db/client'
import { getStudioEventService } from '../studio-events/server-repository'
import { PostgresPropertyRepository } from './postgres-repository'
import type { PropertyRepository } from './repository'
import { PropertyService } from './service'

let propertyService: PropertyService | undefined
let propertyRepository: PropertyRepository | undefined

export function getPropertyRepository() {
  propertyRepository ??= new PostgresPropertyRepository(getDb())
  return propertyRepository
}

export function getPropertyService() {
  propertyService ??= new PropertyService(
    getPropertyRepository(),
    getStudioEventService(),
  )
  return propertyService
}
