import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import {
  organizations,
  propertyProjects,
} from '../properties/schema'
import type { StudioEventMetadata } from './domain'

export const studioProductEvents = pgTable(
  'studio_product_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    propertyProjectId: uuid('property_project_id').references(
      () => propertyProjects.id,
      { onDelete: 'cascade' },
    ),
    name: text('name').notNull(),
    contractVersion: text('contract_version').notNull(),
    metadata: jsonb('metadata')
      .$type<StudioEventMetadata>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('studio_events_org_created_idx').on(
      table.organizationId,
      table.createdAt,
    ),
    index('studio_events_project_created_idx').on(
      table.propertyProjectId,
      table.createdAt,
    ),
  ],
)
