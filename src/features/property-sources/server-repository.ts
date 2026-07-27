import 'server-only'
import { getDb } from '@/lib/db/client'
import { getPropertyRepository } from '../properties/server-repository'
import { PostgresPropertySourceRepository } from './postgres-repository'
import type { PropertySourceRepository } from './repository'
import { PropertySourceService } from './service'

let propertySourceRepository: PropertySourceRepository | undefined
let propertySourceService: PropertySourceService | undefined

export function getPropertySourceRepository() {
  propertySourceRepository ??= new PostgresPropertySourceRepository(getDb())
  return propertySourceRepository
}

export function getPropertySourceService() {
  propertySourceService ??= new PropertySourceService(
    getPropertyRepository(),
    getPropertySourceRepository(),
  )
  return propertySourceService
}
