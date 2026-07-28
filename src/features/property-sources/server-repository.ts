import 'server-only'
import { getDb } from '@/lib/db/client'
import { getPropertyRepository } from '../properties/server-repository'
import { getStudioEventService } from '../studio-events/server-repository'
import { AwsPropertySourceObjectPurger } from './aws-object-purge'
import { AwsPropertySourceObjectStore } from './aws-object-store'
import { readAwsPropertySourceConfig } from './aws-config'
import { PropertySourceCallbackService } from './callback-service'
import { PostgresPropertySourceRepository } from './postgres-repository'
import type { PropertySourceRepository } from './repository'
import { PropertySourceService } from './service'
import { PropertySourceUploadService } from './upload-service'

let propertySourceRepository: PropertySourceRepository | undefined
let propertySourceService: PropertySourceService | undefined
let propertySourceUploadService: PropertySourceUploadService | undefined
let propertySourceCallbackService:
  | PropertySourceCallbackService
  | undefined
let propertySourceObjectPurger:
  | AwsPropertySourceObjectPurger
  | undefined

export function getPropertySourceRepository() {
  propertySourceRepository ??= new PostgresPropertySourceRepository(getDb())
  return propertySourceRepository
}

export function getPropertySourceObjectPurger() {
  const config = readAwsPropertySourceConfig()
  propertySourceObjectPurger ??= new AwsPropertySourceObjectPurger({
    region: config.region,
    bucket: config.bucket,
    deletionRoleArn: config.deletionRoleArn,
  })
  return propertySourceObjectPurger
}

export function getPropertySourceService() {
  propertySourceService ??= new PropertySourceService(
    getPropertyRepository(),
    getPropertySourceRepository(),
    getStudioEventService(),
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

export function getPropertySourceCallbackService() {
  propertySourceCallbackService ??= new PropertySourceCallbackService(
    getPropertyRepository(),
    getPropertySourceRepository(),
    getPropertySourceService(),
    getStudioEventService(),
  )
  return propertySourceCallbackService
}
