import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type {
  CreatePropertyFactInput,
  CreatePropertyInput,
  PropertyFact,
  PropertyProject,
  UpdatePropertyFactInput,
  UpdatePropertyInput,
} from './domain'
import { propertyFactValueTypeSchema } from './domain'
import type { AuditRecord, PropertyRepository } from './repository'
import {
  organizationMemberships,
  organizations,
  propertyAuditEvents,
  propertyFacts,
  propertyProjects,
} from './schema'
import { mapPropertyFactWriteError } from './errors'

type PropertyProjectRow = typeof propertyProjects.$inferSelect
type PropertyFactRow = typeof propertyFacts.$inferSelect

export class PostgresPropertyRepository<
  TQueryResult extends PgQueryResultHKT = PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
> implements PropertyRepository {
  constructor(
    private readonly database: PgDatabase<TQueryResult, TFullSchema>,
  ) {}

  async getOrCreatePersonalOrganization(userId: string) {
    const [organization] = await this.database
      .insert(organizations)
      .values({
        name: 'Moje Studio',
        ownerUserId: userId,
      })
      .onConflictDoUpdate({
        target: organizations.ownerUserId,
        set: {
          ownerUserId: userId,
          updatedAt: new Date(),
        },
      })
      .returning({ id: organizations.id })

    await this.database
      .insert(organizationMemberships)
      .values({
        organizationId: organization.id,
        userId,
        role: 'owner',
      })
      .onConflictDoNothing()

    return organization.id
  }

  async listProjects(userId: string) {
    const rows = await this.database
      .select({ project: propertyProjects })
      .from(propertyProjects)
      .innerJoin(
        organizationMemberships,
        eq(
          propertyProjects.organizationId,
          organizationMemberships.organizationId,
        ),
      )
      .where(eq(organizationMemberships.userId, userId))
      .orderBy(desc(propertyProjects.updatedAt))

    return rows.map(({ project }) => mapProject(project))
  }

  async getProject(userId: string, projectId: string) {
    const [row] = await this.database
      .select({ project: propertyProjects })
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
          eq(propertyProjects.id, projectId),
          eq(organizationMemberships.userId, userId),
        ),
      )
      .limit(1)

    return row ? mapProject(row.project) : null
  }

  async createProject(
    userId: string,
    organizationId: string,
    input: CreatePropertyInput,
  ) {
    const [membership] = await this.database
      .select({ userId: organizationMemberships.userId })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, userId),
        ),
      )
      .limit(1)

    if (!membership) throw new Error('ORGANIZATION_NOT_FOUND')

    const [project] = await this.database
      .insert(propertyProjects)
      .values({
        ...input,
        organizationId,
        createdByUserId: userId,
      })
      .returning()

    return mapProject(project)
  }

  async updateProject(
    userId: string,
    projectId: string,
    input: UpdatePropertyInput,
  ) {
    const project = await this.getProject(userId, projectId)
    if (!project) return null

    const [updated] = await this.database
      .update(propertyProjects)
      .set({
        ...input,
        updatedAt: new Date(),
        archivedAt:
          input.stage === 'archived'
            ? new Date()
            : input.stage
              ? null
              : project.archivedAt,
      })
      .where(
        and(
          eq(propertyProjects.id, projectId),
          eq(propertyProjects.organizationId, project.organizationId),
        ),
      )
      .returning()

    return updated ? mapProject(updated) : null
  }

  async listFacts(userId: string, projectId: string) {
    if (!(await this.getProject(userId, projectId))) return []

    const rows = await this.database
      .select()
      .from(propertyFacts)
      .where(eq(propertyFacts.propertyProjectId, projectId))
      .orderBy(asc(propertyFacts.category), asc(propertyFacts.label))

    return rows.map(mapFact)
  }

  async getFact(userId: string, projectId: string, factId: string) {
    if (!(await this.getProject(userId, projectId))) return null

    const [row] = await this.database
      .select()
      .from(propertyFacts)
      .where(
        and(
          eq(propertyFacts.id, factId),
          eq(propertyFacts.propertyProjectId, projectId),
        ),
      )
      .limit(1)

    return row ? mapFact(row) : null
  }

  async createFact(
    userId: string,
    projectId: string,
    input: CreatePropertyFactInput,
  ) {
    if (!(await this.getProject(userId, projectId))) return null

    let fact: PropertyFactRow | undefined
    try {
      const rows = await this.database
        .insert(propertyFacts)
        .values({
          ...input,
          propertyProjectId: projectId,
          createdByType: 'user',
          createdById: userId,
          confirmedAt: input.status === 'confirmed' ? new Date() : null,
        })
        .returning()
      fact = rows[0]
    } catch (error) {
      throw mapPropertyFactWriteError(error)
    }

    return fact ? mapFact(fact) : null
  }

  async updateFact(
    userId: string,
    projectId: string,
    factId: string,
    input: UpdatePropertyFactInput,
  ) {
    const current = await this.getFact(userId, projectId, factId)
    if (!current) return null

    const { actorType: _actorType, ...changes } = input
    void _actorType
    const confirmationChanges =
      changes.status === 'confirmed'
        ? {
            confirmedAt: new Date(),
          }
        : changes.status
          ? {
              confirmedAt: null,
              confirmedByUserId: null,
            }
          : {}

    let updated: PropertyFactRow | undefined
    try {
      const rows = await this.database
        .update(propertyFacts)
        .set({
          ...changes,
          ...confirmationChanges,
          version: sql`${propertyFacts.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(propertyFacts.id, factId),
            eq(propertyFacts.propertyProjectId, projectId),
          ),
        )
        .returning()
      updated = rows[0]
    } catch (error) {
      throw mapPropertyFactWriteError(error)
    }

    return updated ? mapFact(updated) : null
  }

  async appendAudit(record: Omit<AuditRecord, 'id' | 'createdAt'>) {
    await this.database.insert(propertyAuditEvents).values(record)
  }

  async listAudit(userId: string, projectId: string) {
    if (!(await this.getProject(userId, projectId))) return []

    return this.database
      .select()
      .from(propertyAuditEvents)
      .where(eq(propertyAuditEvents.propertyProjectId, projectId))
      .orderBy(desc(propertyAuditEvents.createdAt))
  }

  async exportForUser(userId: string) {
    const memberships = await this.database
      .select({ organizationId: organizationMemberships.organizationId })
      .from(organizationMemberships)
      .where(eq(organizationMemberships.userId, userId))

    if (memberships.length === 0) {
      return { projects: [], facts: [], audit: [] }
    }

    const organizationIds = memberships.map((row) => row.organizationId)
    const projectRows = await this.database
      .select()
      .from(propertyProjects)
      .where(inArray(propertyProjects.organizationId, organizationIds))
      .orderBy(desc(propertyProjects.updatedAt))

    const projectIds = projectRows.map((project) => project.id)
    const factRows =
      projectIds.length === 0
        ? []
        : await this.database
            .select()
            .from(propertyFacts)
            .where(inArray(propertyFacts.propertyProjectId, projectIds))
            .orderBy(asc(propertyFacts.createdAt))

    const auditRows = await this.database
      .select()
      .from(propertyAuditEvents)
      .where(inArray(propertyAuditEvents.organizationId, organizationIds))
      .orderBy(asc(propertyAuditEvents.createdAt))

    return {
      projects: projectRows.map(mapProject),
      facts: factRows.map(mapFact),
      audit: auditRows,
    }
  }

  async deleteForUser(userId: string) {
    await this.database.transaction(async (transaction) => {
      await transaction
        .delete(organizationMemberships)
        .where(eq(organizationMemberships.userId, userId))

      await transaction
        .delete(organizations)
        .where(eq(organizations.ownerUserId, userId))
    })
  }
}

function mapProject(row: PropertyProjectRow): PropertyProject {
  return {
    ...row,
    district: row.district ?? undefined,
    address: row.address ?? undefined,
    plotIdentifier: row.plotIdentifier ?? undefined,
  }
}

function mapFact(row: PropertyFactRow): PropertyFact {
  return {
    ...row,
    valueType: propertyFactValueTypeSchema.parse(row.valueType),
    value: row.value,
    unit: row.unit ?? undefined,
    sourceIds: row.sourceIds,
    confirmedByUserId: row.confirmedByUserId ?? undefined,
  }
}
