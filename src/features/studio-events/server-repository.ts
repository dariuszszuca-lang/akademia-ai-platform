import 'server-only'
import { getDb } from '@/lib/db/client'
import { PostgresStudioEventRepository } from './postgres-repository'
import type { StudioEventRepository } from './repository'
import { StudioEventService } from './service'

let studioEventRepository: StudioEventRepository | undefined
let studioEventService: StudioEventService | undefined

export function getStudioEventRepository() {
  studioEventRepository ??= new PostgresStudioEventRepository(getDb())
  return studioEventRepository
}

export function getStudioEventService() {
  studioEventService ??= new StudioEventService(
    getStudioEventRepository(),
  )
  return studioEventService
}
