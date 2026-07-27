import 'server-only'
import { getDb } from '@/lib/db/client'
import { getPropertyRepository } from '../properties/server-repository'
import { AwsPropertySourceObjectStore } from './aws-object-store'
import { readAwsPropertySourceConfig } from './aws-config'
import { PostgresPropertySourceRepository } from './postgres-repository'
import type { PropertySourceRepository } from './repository'
import { PropertySourceService } from './service'
import { PropertySourceUploadService } from './upload-service'

let propertySourceRepository: PropertySourceRepository | undefined
let propertySourceService: PropertySourceService | undefined
let propertySourceUploadService: PropertySourceUploadService | undefined

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

export function getPropertySourceUploadService() {
  propertySourceUploadService ??= new PropertySourceUploadService(
    getPropertySourceService(),
    getPropertySourceRepository(),
    new AwsPropertySourceObjectStore(readAwsPropertySourceConfig()),
  )
  return propertySourceUploadService
}
