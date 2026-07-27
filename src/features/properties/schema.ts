import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import {
  actorTypes,
  addressModes,
  propertyFactStatuses,
  propertyFactVisibilities,
  propertyStages,
  propertyTypes,
  transactionTypes,
} from './domain'

export const propertyTypeEnum = pgEnum('property_type', propertyTypes)
export const transactionTypeEnum = pgEnum(
  'property_transaction_type',
  transactionTypes,
)
export const propertyStageEnum = pgEnum('property_stage', propertyStages)
export const addressModeEnum = pgEnum('property_address_mode', addressModes)
export const factStatusEnum = pgEnum(
  'property_fact_status',
  propertyFactStatuses,
)
export const factVisibilityEnum = pgEnum(
  'property_fact_visibility',
  propertyFactVisibilities,
)
export const actorTypeEnum = pgEnum('property_actor_type', actorTypes)
export const organizationRoleEnum = pgEnum('organization_role', [
  'owner',
  'admin',
  'agent',
  'marketer',
  'viewer',
])

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    ownerUserId: text('owner_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('organizations_owner_user_idx').on(table.ownerUserId),
  ],
)

export const organizationMemberships = pgTable(
  'organization_memberships',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    role: organizationRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index('organization_memberships_user_idx').on(table.userId),
  ],
)

export const propertyProjects = pgTable(
  'property_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdByUserId: text('created_by_user_id').notNull(),
    title: text('title').notNull(),
    propertyType: propertyTypeEnum('property_type').notNull(),
    transactionType: transactionTypeEnum('transaction_type').notNull(),
    stage: propertyStageEnum('stage').notNull().default('draft'),
    city: text('city').notNull(),
    district: text('district'),
    addressMode: addressModeEnum('address_mode').notNull(),
    address: text('address'),
    plotIdentifier: text('plot_identifier'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    index('property_projects_org_updated_idx').on(
      table.organizationId,
      table.updatedAt,
    ),
  ],
)

export const propertyFacts = pgTable(
  'property_facts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyProjectId: uuid('property_project_id')
      .notNull()
      .references(() => propertyProjects.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    category: text('category').notNull(),
    valueType: text('value_type').notNull(),
    value: jsonb('value'),
    unit: text('unit'),
    status: factStatusEnum('status').notNull(),
    visibility: factVisibilityEnum('visibility').notNull().default('internal'),
    sourceIds: jsonb('source_ids').$type<string[]>().notNull().default([]),
    createdByType: actorTypeEnum('created_by_type').notNull(),
    createdById: text('created_by_id').notNull(),
    confirmedByUserId: text('confirmed_by_user_id'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('property_facts_project_key_idx').on(
      table.propertyProjectId,
      table.key,
    ),
    index('property_facts_project_status_idx').on(
      table.propertyProjectId,
      table.status,
    ),
  ],
)

export const propertyAuditEvents = pgTable(
  'property_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    propertyProjectId: uuid('property_project_id').references(
      () => propertyProjects.id,
      { onDelete: 'cascade' },
    ),
    actorType: actorTypeEnum('actor_type').notNull(),
    actorId: text('actor_id').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('property_audit_property_created_idx').on(
      table.propertyProjectId,
      table.createdAt,
    ),
  ],
)
