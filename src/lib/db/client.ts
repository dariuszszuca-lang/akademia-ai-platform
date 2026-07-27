import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required')
}

const globalForDb = globalThis as unknown as {
  propertyStudioSql?: ReturnType<typeof postgres>
}

const sql =
  globalForDb.propertyStudioSql ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === 'production' ? 10 : 1,
    prepare: false,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.propertyStudioSql = sql
}

export const db = drizzle(sql)
