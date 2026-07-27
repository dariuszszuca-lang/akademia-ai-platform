import 'server-only'
import { db } from '@/lib/db/client'
import { PostgresPropertyRepository } from './postgres-repository'

export const postgresPropertyRepository = new PostgresPropertyRepository(db)
