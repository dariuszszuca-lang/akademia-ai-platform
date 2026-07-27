import { getTableColumns, getTableName } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import {
  extractionCallbackNonces,
  propertyFactProposals,
  propertySources,
  sourceProcessingJobs,
} from './schema'

describe('property source database schema', () => {
  it('uses stable table names', () => {
    expect(getTableName(propertySources)).toBe('property_sources')
    expect(getTableName(sourceProcessingJobs)).toBe(
      'property_source_processing_jobs',
    )
    expect(getTableName(propertyFactProposals)).toBe(
      'property_fact_proposals',
    )
    expect(getTableName(extractionCallbackNonces)).toBe(
      'extraction_callback_nonces',
    )
  })

  it('stores tenant and private object ownership on every source', () => {
    const columns = getTableColumns(propertySources)

    expect(columns.organizationId.notNull).toBe(true)
    expect(columns.propertyProjectId.notNull).toBe(true)
    expect(columns.storageKey.notNull).toBe(true)
    expect(columns.checksumSha256.notNull).toBe(true)
    expect(columns.status.notNull).toBe(true)
  })

  it('stores idempotency, lifecycle and cost on processing jobs', () => {
    const columns = getTableColumns(sourceProcessingJobs)

    expect(columns.organizationId.notNull).toBe(true)
    expect(columns.sourceId.notNull).toBe(true)
    expect(columns.idempotencyKey.notNull).toBe(true)
    expect(columns.status.notNull).toBe(true)
    expect(columns.attempt.notNull).toBe(true)
    expect(columns.estimatedCostUsd).toBeDefined()
  })

  it('stores evidence, conflicts and human decisions on proposals', () => {
    const columns = getTableColumns(propertyFactProposals)

    expect(columns.organizationId.notNull).toBe(true)
    expect(columns.sourceId.notNull).toBe(true)
    expect(columns.jobId.notNull).toBe(true)
    expect(columns.evidenceText.notNull).toBe(true)
    expect(columns.evidenceLocator.notNull).toBe(true)
    expect(columns.conflictsWithFactId).toBeDefined()
    expect(columns.decidedByUserId).toBeDefined()
    expect(columns.decisionFingerprint).toBeDefined()
  })

  it('stores single-use callback nonce lifecycle', () => {
    const columns = getTableColumns(extractionCallbackNonces)

    expect(columns.nonce.notNull).toBe(true)
    expect(columns.jobId.notNull).toBe(true)
    expect(columns.expiresAt.notNull).toBe(true)
    expect(columns.usedAt).toBeDefined()
  })
})
