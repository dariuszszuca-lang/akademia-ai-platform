import 'server-only'
import { getDb } from '@/lib/db/client'
import { PostgresPropertyRepository } from './postgres-repository'
import { PropertyService } from './service'

let propertyService: PropertyService | undefined

export function getPropertyService() {
  propertyService ??= new PropertyService(
    new PostgresPropertyRepository(getDb()),
  )
  return propertyService
}
