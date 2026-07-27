import 'server-only'
import { getDb } from '@/lib/db/client'
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
  propertyService ??= new PropertyService(getPropertyRepository())
  return propertyService
}
