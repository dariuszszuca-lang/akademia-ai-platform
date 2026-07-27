import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import {
  factProposalStatuses,
  propertySourceStatuses,
  sourceJobStatuses,
  type DecisionFactSnapshot,
  type EvidenceLocator,
  type ProposalDecision,
} from './domain'
import {
  organizations,
  propertyFacts,
  propertyProjects,
} from '../properties/schema'

export const propertySourceStatusEnum = pgEnum(
  'property_source_status',
  propertySourceStatuses,
)
export const sourceJobStatusEnum = pgEnum(
  'property_source_job_status',
  sourceJobStatuses,
)
export const factProposalStatusEnum = pgEnum(
  'property_fact_proposal_status',
  factProposalStatuses,
)

export const propertySources = pgTable(
  'property_sources',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    propertyProjectId: uuid('property_project_id')
      .notNull()
      .references(() => propertyProjects.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    fileName: text('file_name').notNull(),
    mediaType: text('media_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    checksumSha256: text('checksum_sha256').notNull(),
    status: propertySourceStatusEnum('status')
      .notNull()
      .default('upload_pending'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('property_sources_project_storage_key_idx').on(
      table.propertyProjectId,
      table.storageKey,
    ),
    index('property_sources_org_project_created_idx').on(
      table.organizationId,
      table.propertyProjectId,
      table.createdAt,
    ),
    index('property_sources_project_status_idx').on(
      table.propertyProjectId,
      table.status,
    ),
    check('property_sources_size_positive', sql`${table.sizeBytes} > 0`),
  ],
)

export const sourceProcessingJobs = pgTable(
  'property_source_processing_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    propertyProjectId: uuid('property_project_id')
      .notNull()
      .references(() => propertyProjects.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => propertySources.id, { onDelete: 'cascade' }),
    idempotencyKey: text('idempotency_key').notNull(),
    status: sourceJobStatusEnum('status').notNull().default('queued'),
    attempt: integer('attempt').notNull().default(1),
    pipelineVersion: text('pipeline_version')
      .notNull()
      .default('property-source-v1'),
    provider: text('provider'),
    modelId: text('model_id'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    estimatedCostUsd: numeric('estimated_cost_usd', {
      precision: 12,
      scale: 6,
    }),
    providerCostMicrounits: bigint('provider_cost_microunits', {
      mode: 'number',
    }),
    currency: text('currency'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('property_source_jobs_idempotency_idx').on(
      table.idempotencyKey,
    ),
    index('property_source_jobs_source_created_idx').on(
      table.sourceId,
      table.createdAt,
    ),
    check('property_source_jobs_attempt_positive', sql`${table.attempt} > 0`),
    check(
      'property_source_jobs_provider_cost_nonnegative',
      sql`${table.providerCostMicrounits} IS NULL OR ${table.providerCostMicrounits} >= 0`,
    ),
  ],
)

export const propertyFactProposals = pgTable(
  'property_fact_proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    propertyProjectId: uuid('property_project_id')
      .notNull()
      .references(() => propertyProjects.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => propertySources.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => sourceProcessingJobs.id, { onDelete: 'cascade' }),
    externalKey: text('external_key').notNull(),
    factKey: text('fact_key').notNull(),
    label: text('label').notNull(),
    category: text('category').notNull(),
    valueType: text('value_type').notNull(),
    value: jsonb('value'),
    unit: text('unit'),
    confidence: doublePrecision('confidence').notNull(),
    evidenceText: text('evidence_text').notNull(),
    evidenceLocator: jsonb('evidence_locator')
      .$type<EvidenceLocator>()
      .notNull(),
    status: factProposalStatusEnum('status').notNull().default('pending'),
    conflictsWithFactId: uuid('conflicts_with_fact_id').references(
      () => propertyFacts.id,
      { onDelete: 'set null' },
    ),
    decidedByUserId: text('decided_by_user_id'),
    decisionNote: text('decision_note'),
    decision: jsonb('decision').$type<ProposalDecision>(),
    decisionFingerprint: text('decision_fingerprint'),
    decisionFactSnapshot:
      jsonb('decision_fact_snapshot').$type<DecisionFactSnapshot>(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('property_fact_proposals_job_external_key_idx').on(
      table.jobId,
      table.externalKey,
    ),
    index('property_fact_proposals_project_status_created_idx').on(
      table.propertyProjectId,
      table.status,
      table.createdAt,
    ),
    index('property_fact_proposals_source_created_idx').on(
      table.sourceId,
      table.createdAt,
    ),
    check(
      'property_fact_proposals_confidence_range',
      sql`${table.confidence} >= 0 AND ${table.confidence} <= 1`,
    ),
  ],
)

export const extractionCallbackNonces = pgTable(
  'extraction_callback_nonces',
  {
    nonce: text('nonce').primaryKey(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => sourceProcessingJobs.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('extraction_callback_nonces_expiry_idx').on(table.expiresAt)],
)
