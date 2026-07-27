import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const globalForDb = globalThis as unknown as {
  propertyStudioSql?: ReturnType<typeof postgres>
  propertyStudioDb?: ReturnType<typeof drizzle>
}

export function getDb() {
  if (globalForDb.propertyStudioDb) return globalForDb.propertyStudioDb

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required')
  }

  const sql =
    globalForDb.propertyStudioSql ??
    postgres(connectionString, {
      max: process.env.NODE_ENV === 'production' ? 10 : 1,
      prepare: false,
    })
  const database = drizzle(sql)

  if (process.env.NODE_ENV !== 'production') {
    globalForDb.propertyStudioSql = sql
    globalForDb.propertyStudioDb = database
  }

  return database
}
