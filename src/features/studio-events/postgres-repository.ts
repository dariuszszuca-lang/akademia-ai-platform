import { and, asc, desc, eq } from 'drizzle-orm'
import type {
  PgDatabase,
  PgQueryResultHKT,
} from 'drizzle-orm/pg-core'
import {
  organizationMemberships,
  propertyProjects,
} from '../properties/schema'
import {
  studioEventInputSchema,
  type StudioEventInput,
  type StudioProductEvent,
} from './domain'
import type { StudioEventRepository } from './repository'
import { studioProductEvents } from './schema'

type StudioEventRow = typeof studioProductEvents.$inferSelect

export class PostgresStudioEventRepository<
  TQueryResult extends PgQueryResultHKT = PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
> implements StudioEventRepository
{
  constructor(
    private readonly database: PgDatabase<
      TQueryResult,
      TFullSchema
    >,
  ) {}

  async append(rawInput: StudioEventInput) {
    const input = studioEventInputSchema.parse(rawInput)

    return this.database.transaction(async (transaction) => {
      if (input.propertyProjectId) {
        const [context] = await transaction
          .select({ projectId: propertyProjects.id })
          .from(propertyProjects)
          .innerJoin(
            organizationMemberships,
            eq(
              propertyProjects.organizationId,
              organizationMemberships.organizationId,
            ),
          )
          .where(
            and(
              eq(propertyProjects.id, input.propertyProjectId),
              eq(
                propertyProjects.organizationId,
                input.organizationId,
              ),
              eq(organizationMemberships.userId, input.userId),
            ),
          )
          .limit(1)
        if (!context) {
          throw new Error('STUDIO_EVENT_CONTEXT_MISMATCH')
        }
      } else {
        const [membership] = await transaction
          .select({ userId: organizationMemberships.userId })
          .from(organizationMemberships)
          .where(
            and(
              eq(
                organizationMemberships.organizationId,
                input.organizationId,
              ),
              eq(organizationMemberships.userId, input.userId),
            ),
          )
          .limit(1)
        if (!membership) {
          throw new Error('STUDIO_EVENT_CONTEXT_MISMATCH')
        }
      }

      const [created] = await transaction
        .insert(studioProductEvents)
        .values({
          ...input,
          propertyProjectId: input.propertyProjectId ?? null,
        })
        .returning()
      return mapStudioEvent(created)
    })
  }

  async listForProject(
    userId: string,
    propertyProjectId: string,
  ) {
    const rows = await this.database
      .select({ event: studioProductEvents })
      .from(studioProductEvents)
      .innerJoin(
        organizationMemberships,
        eq(
          studioProductEvents.organizationId,
          organizationMemberships.organizationId,
        ),
      )
      .where(
        and(
          eq(
            studioProductEvents.propertyProjectId,
            propertyProjectId,
          ),
          eq(organizationMemberships.userId, userId),
        ),
      )
      .orderBy(desc(studioProductEvents.createdAt))

    return rows.map(({ event }) => mapStudioEvent(event))
  }

  async exportForUser(userId: string) {
    const rows = await this.database
      .select({ event: studioProductEvents })
      .from(studioProductEvents)
      .innerJoin(
        organizationMemberships,
        eq(
          studioProductEvents.organizationId,
          organizationMemberships.organizationId,
        ),
      )
      .where(eq(organizationMemberships.userId, userId))
      .orderBy(asc(studioProductEvents.createdAt))

    return rows.map(({ event }) => mapStudioEvent(event))
  }
}

function mapStudioEvent(row: StudioEventRow): StudioProductEvent {
  const input = studioEventInputSchema.parse({
    organizationId: row.organizationId,
    userId: row.userId,
    propertyProjectId: row.propertyProjectId,
    name: row.name,
    contractVersion: row.contractVersion,
    metadata: row.metadata,
  })
  return {
    ...input,
    id: row.id,
    createdAt: row.createdAt,
  }
}
