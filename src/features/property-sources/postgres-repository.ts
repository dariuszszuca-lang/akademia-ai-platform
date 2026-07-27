import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { PropertyFact } from '../properties/domain'
import { propertyFactValueTypeSchema } from '../properties/domain'
import {
  organizationMemberships,
  propertyAuditEvents,
  propertyFacts,
} from '../properties/schema'
import {
  createPropertySourceSchema,
  ingestFactProposalSchema,
  proposalDecisionSchema,
  type DecisionFactSnapshot,
  type PropertyFactProposal,
  type PropertySource,
  type SourceProcessingJob,
} from './domain'
import { propertyFactValuesEqual } from './value-comparison'
import {
  propertyFactProposals,
  propertySources,
  sourceProcessingJobs,
} from './schema'
import type {
  DecideProposalCommand,
  IngestedProposal,
  NewPropertySourceRecord,
  NewSourceJobRecord,
  ProposalDecisionResult,
  ProposalIngestionContext,
  ProposalListFilter,
  PropertySourceRepository,
  TrustedProposalInput,
} from './repository'

type SourceRow = typeof propertySources.$inferSelect
type JobRow = typeof sourceProcessingJobs.$inferSelect
type ProposalRow = typeof propertyFactProposals.$inferSelect
type FactRow = typeof propertyFacts.$inferSelect

type TransactionOutcome =
  | { kind: 'success'; result: ProposalDecisionResult }
  | { kind: 'conflict_changed' }

export class PostgresPropertySourceRepository<
  TQueryResult extends PgQueryResultHKT = PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
> implements PropertySourceRepository
{
  constructor(
    private readonly database: PgDatabase<TQueryResult, TFullSchema>,
  ) {}

  async createSource(record: NewPropertySourceRecord) {
    const [source] = await this.database
      .insert(propertySources)
      .values(record)
      .returning()

    return mapSource(source)
  }

  async listSources(
    organizationId: string,
    propertyProjectId: string,
  ) {
    const rows = await this.database
      .select()
      .from(propertySources)
      .where(
        and(
          eq(propertySources.organizationId, organizationId),
          eq(propertySources.propertyProjectId, propertyProjectId),
        ),
      )
      .orderBy(desc(propertySources.createdAt), desc(propertySources.id))

    return rows.map(mapSource)
  }

  async getSource(
    organizationId: string,
    propertyProjectId: string,
    sourceId: string,
  ) {
    const [source] = await this.database
      .select()
      .from(propertySources)
      .where(
        and(
          eq(propertySources.id, sourceId),
          eq(propertySources.organizationId, organizationId),
          eq(propertySources.propertyProjectId, propertyProjectId),
        ),
      )
      .limit(1)

    return source ? mapSource(source) : null
  }

  async getSourceInternal(sourceId: string) {
    const [source] = await this.database
      .select()
      .from(propertySources)
      .where(eq(propertySources.id, sourceId))
      .limit(1)

    return source ? mapSource(source) : null
  }

  async createJobInternal(record: NewSourceJobRecord) {
    const [inserted] = await this.database
      .insert(sourceProcessingJobs)
      .values(record)
      .onConflictDoNothing({
        target: sourceProcessingJobs.idempotencyKey,
      })
      .returning()

    if (inserted) return mapJob(inserted)

    const existing = await this.getJobByIdempotencyKeyInternal(
      record.idempotencyKey,
    )
    if (!existing) throw new Error('JOB_CREATE_FAILED')
    if (existing.sourceId !== record.sourceId) {
      throw new Error('IDEMPOTENCY_KEY_REUSED')
    }
    return existing
  }

  async getJobInternal(jobId: string) {
    const [job] = await this.database
      .select()
      .from(sourceProcessingJobs)
      .where(eq(sourceProcessingJobs.id, jobId))
      .limit(1)

    return job ? mapJob(job) : null
  }

  async getJobByIdempotencyKeyInternal(idempotencyKey: string) {
    const [job] = await this.database
      .select()
      .from(sourceProcessingJobs)
      .where(eq(sourceProcessingJobs.idempotencyKey, idempotencyKey))
      .limit(1)

    return job ? mapJob(job) : null
  }

  async ingestProposalsInternal(
    context: ProposalIngestionContext,
    proposals: TrustedProposalInput[],
  ) {
    return this.database.transaction(async (transaction) => {
      const results: IngestedProposal[] = []

      for (const proposal of proposals) {
        const [inserted] = await transaction
          .insert(propertyFactProposals)
          .values({
            ...proposal,
            unit: proposal.unit ?? null,
            ...context,
          })
          .onConflictDoNothing({
            target: [
              propertyFactProposals.jobId,
              propertyFactProposals.externalKey,
            ],
          })
          .returning()

        if (inserted) {
          results.push({ proposal: mapProposal(inserted), created: true })
          continue
        }

        const [existing] = await transaction
          .select()
          .from(propertyFactProposals)
          .where(
            and(
              eq(propertyFactProposals.organizationId, context.organizationId),
              eq(
                propertyFactProposals.propertyProjectId,
                context.propertyProjectId,
              ),
              eq(propertyFactProposals.sourceId, context.sourceId),
              eq(propertyFactProposals.jobId, context.jobId),
              eq(propertyFactProposals.externalKey, proposal.externalKey),
            ),
          )
          .limit(1)

        if (!existing) throw new Error('PROPOSAL_CREATE_FAILED')
        results.push({ proposal: mapProposal(existing), created: false })
      }

      return results
    })
  }

  async listProposals(
    organizationId: string,
    propertyProjectId: string,
    filter: ProposalListFilter = {},
  ) {
    const conditions = [
      eq(propertyFactProposals.organizationId, organizationId),
      eq(propertyFactProposals.propertyProjectId, propertyProjectId),
    ]
    if (filter.sourceId) {
      conditions.push(eq(propertyFactProposals.sourceId, filter.sourceId))
    }
    if (filter.statuses) {
      conditions.push(inArray(propertyFactProposals.status, filter.statuses))
    }

    const rows = await this.database
      .select()
      .from(propertyFactProposals)
      .where(and(...conditions))
      .orderBy(
        desc(propertyFactProposals.createdAt),
        desc(propertyFactProposals.id),
      )

    return rows.map(mapProposal)
  }

  async getProposal(
    organizationId: string,
    propertyProjectId: string,
    proposalId: string,
  ) {
    const [proposal] = await this.database
      .select()
      .from(propertyFactProposals)
      .where(
        and(
          eq(propertyFactProposals.id, proposalId),
          eq(propertyFactProposals.organizationId, organizationId),
          eq(propertyFactProposals.propertyProjectId, propertyProjectId),
        ),
      )
      .limit(1)

    return proposal ? mapProposal(proposal) : null
  }

  async decideProposal(command: DecideProposalCommand) {
    const outcome = await this.database.transaction<TransactionOutcome>(
      async (transaction) => {
        const [membership] = await transaction
          .select({ userId: organizationMemberships.userId })
          .from(organizationMemberships)
          .where(
            and(
              eq(
                organizationMemberships.organizationId,
                command.organizationId,
              ),
              eq(organizationMemberships.userId, command.userId),
            ),
          )
          .limit(1)
        if (!membership) throw new Error('PROPOSAL_NOT_FOUND')

        const [proposal] = await transaction
          .select()
          .from(propertyFactProposals)
          .where(
            and(
              eq(propertyFactProposals.id, command.proposalId),
              eq(
                propertyFactProposals.organizationId,
                command.organizationId,
              ),
              eq(
                propertyFactProposals.propertyProjectId,
                command.propertyProjectId,
              ),
            ),
          )
          .limit(1)
          .for('update')

        if (!proposal) throw new Error('PROPOSAL_NOT_FOUND')

        if (proposal.decisionFingerprint === command.decisionFingerprint) {
          return {
            kind: 'success',
            result: {
              proposal: mapProposal(proposal),
              fact: proposal.decisionFactSnapshot
                ? deserializeFactSnapshot(proposal.decisionFactSnapshot)
                : null,
            },
          }
        }

        if (isFinalProposalStatus(proposal.status)) {
          throw new Error('PROPOSAL_ALREADY_DECIDED')
        }

        const [currentFact] = await transaction
          .select()
          .from(propertyFacts)
          .where(
            and(
              eq(
                propertyFacts.propertyProjectId,
                command.propertyProjectId,
              ),
              eq(propertyFacts.key, proposal.factKey),
            ),
          )
          .limit(1)

        if (
          proposal.status === 'pending' &&
          command.decision.action === 'accept' &&
          currentFact &&
          !propertyFactValuesEqual(currentFact.value, proposal.value)
        ) {
          const [updatedConflict] = await transaction
            .update(propertyFactProposals)
            .set({
              status: 'conflict',
              conflictsWithFactId: currentFact.id,
              updatedAt: new Date(),
            })
            .where(eq(propertyFactProposals.id, proposal.id))
            .returning()

          await transaction.insert(propertyAuditEvents).values({
            organizationId: command.organizationId,
            propertyProjectId: command.propertyProjectId,
            actorType: 'user',
            actorId: command.userId,
            action: 'proposal.conflict_detected',
            entityType: 'property_fact_proposal',
            entityId: proposal.id,
            before: proposal,
            after: updatedConflict,
          })

          return { kind: 'conflict_changed' }
        }

        const sourceIds = Array.from(
          new Set([...(currentFact?.sourceIds ?? []), proposal.sourceId]),
        )
        let fact: FactRow | null = null
        let status: PropertyFactProposal['status']

        switch (command.decision.action) {
          case 'accept':
          case 'accept_new':
          case 'correct_and_accept': {
            const value =
              command.decision.action === 'correct_and_accept'
                ? command.decision.value
                : proposal.value

            if (currentFact) {
              ;[fact] = await transaction
                .update(propertyFacts)
                .set({
                  label: proposal.label,
                  category: proposal.category,
                  valueType: proposal.valueType,
                  value,
                  unit: proposal.unit,
                  status: 'confirmed',
                  visibility: currentFact.visibility,
                  sourceIds,
                  confirmedByUserId: command.userId,
                  confirmedAt: new Date(),
                  version: sql`${propertyFacts.version} + 1`,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(propertyFacts.id, currentFact.id),
                    eq(
                      propertyFacts.propertyProjectId,
                      command.propertyProjectId,
                    ),
                  ),
                )
                .returning()
            } else {
              ;[fact] = await transaction
                .insert(propertyFacts)
                .values({
                  propertyProjectId: command.propertyProjectId,
                  key: proposal.factKey,
                  label: proposal.label,
                  category: proposal.category,
                  valueType: proposal.valueType,
                  value,
                  unit: proposal.unit,
                  status: 'confirmed',
                  visibility: 'internal',
                  sourceIds,
                  createdByType: 'user',
                  createdById: command.userId,
                  confirmedByUserId: command.userId,
                  confirmedAt: new Date(),
                })
                .returning()
            }

            if (!fact) throw new Error('FACT_WRITE_FAILED')
            status =
              command.decision.action === 'correct_and_accept'
                ? 'corrected'
                : 'accepted'
            break
          }
          case 'reject':
            status = 'rejected'
            break
          case 'keep_existing':
            if (!currentFact) throw new Error('PROPOSAL_CONFLICT_CHANGED')
            fact = currentFact
            status = 'rejected'
            break
          case 'keep_open':
            if (!currentFact) throw new Error('PROPOSAL_CONFLICT_CHANGED')
            ;[fact] = await transaction
              .update(propertyFacts)
              .set({
                status: 'conflicting',
                sourceIds,
                confirmedByUserId: null,
                confirmedAt: null,
                version: sql`${propertyFacts.version} + 1`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(propertyFacts.id, currentFact.id),
                  eq(
                    propertyFacts.propertyProjectId,
                    command.propertyProjectId,
                  ),
                ),
              )
              .returning()
            if (!fact) throw new Error('FACT_WRITE_FAILED')
            status = 'needs_review'
            break
        }

        const decidedAt = new Date()
        const [updatedProposal] = await transaction
          .update(propertyFactProposals)
          .set({
            status,
            decidedByUserId: command.userId,
            decisionNote:
              'note' in command.decision
                ? (command.decision.note ?? null)
                : null,
            decision: command.decision,
            decisionFingerprint: command.decisionFingerprint,
            decisionFactSnapshot: fact
              ? serializeFactSnapshot(fact)
              : null,
            decidedAt,
            updatedAt: decidedAt,
          })
          .where(
            and(
              eq(propertyFactProposals.id, proposal.id),
              eq(propertyFactProposals.organizationId, command.organizationId),
              eq(
                propertyFactProposals.propertyProjectId,
                command.propertyProjectId,
              ),
            ),
          )
          .returning()

        if (!updatedProposal) throw new Error('PROPOSAL_WRITE_FAILED')

        await transaction.insert(propertyAuditEvents).values({
          organizationId: command.organizationId,
          propertyProjectId: command.propertyProjectId,
          actorType: 'user',
          actorId: command.userId,
          action: 'proposal.decided',
          entityType: 'property_fact_proposal',
          entityId: proposal.id,
          before: proposal,
          after: { proposal: updatedProposal, fact },
        })

        return {
          kind: 'success',
          result: {
            proposal: mapProposal(updatedProposal),
            fact: fact ? mapFact(fact) : null,
          },
        }
      },
    )

    if (outcome.kind === 'conflict_changed') {
      throw new Error('PROPOSAL_CONFLICT_CHANGED')
    }
    return outcome.result
  }

  async exportForUser(userId: string) {
    const memberships = await this.database
      .select({ organizationId: organizationMemberships.organizationId })
      .from(organizationMemberships)
      .where(eq(organizationMemberships.userId, userId))

    if (memberships.length === 0) {
      return { sources: [], sourceJobs: [], factProposals: [] }
    }

    const organizationIds = memberships.map(
      (membership) => membership.organizationId,
    )
    const sourceRows = await this.database
      .select()
      .from(propertySources)
      .where(inArray(propertySources.organizationId, organizationIds))
      .orderBy(propertySources.createdAt)
    const jobRows = await this.database
      .select()
      .from(sourceProcessingJobs)
      .where(inArray(sourceProcessingJobs.organizationId, organizationIds))
      .orderBy(sourceProcessingJobs.createdAt)
    const proposalRows = await this.database
      .select()
      .from(propertyFactProposals)
      .where(inArray(propertyFactProposals.organizationId, organizationIds))
      .orderBy(propertyFactProposals.createdAt)

    return {
      sources: sourceRows.map(mapSource),
      sourceJobs: jobRows.map(mapJob),
      factProposals: proposalRows.map(mapProposal),
    }
  }
}

function mapSource(row: SourceRow): PropertySource {
  const sourceInput = createPropertySourceSchema.parse({
    fileName: row.fileName,
    mediaType: row.mediaType,
    sizeBytes: row.sizeBytes,
    checksumSha256: row.checksumSha256,
  })

  return {
    ...sourceInput,
    id: row.id,
    organizationId: row.organizationId,
    propertyProjectId: row.propertyProjectId,
    storageKey: row.storageKey,
    status: row.status,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapJob(row: JobRow): SourceProcessingJob {
  return {
    ...row,
    estimatedCostUsd: row.estimatedCostUsd,
  }
}

function mapProposal(row: ProposalRow): PropertyFactProposal {
  const proposalInput = ingestFactProposalSchema.parse({
    externalKey: row.externalKey,
    factKey: row.factKey,
    label: row.label,
    category: row.category,
    valueType: row.valueType,
    value: row.value,
    unit: row.unit ?? undefined,
    confidence: row.confidence,
    evidenceText: row.evidenceText,
    evidenceLocator: row.evidenceLocator,
  })

  return {
    ...proposalInput,
    id: row.id,
    organizationId: row.organizationId,
    propertyProjectId: row.propertyProjectId,
    sourceId: row.sourceId,
    jobId: row.jobId,
    status: row.status,
    conflictsWithFactId: row.conflictsWithFactId,
    decidedByUserId: row.decidedByUserId,
    decisionNote: row.decisionNote,
    decision: row.decision
      ? proposalDecisionSchema.parse(row.decision)
      : null,
    decisionFingerprint: row.decisionFingerprint,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapFact(row: FactRow): PropertyFact {
  return {
    ...row,
    valueType: propertyFactValueTypeSchema.parse(row.valueType),
    value: row.value,
    unit: row.unit ?? undefined,
    sourceIds: row.sourceIds,
    confirmedByUserId: row.confirmedByUserId ?? undefined,
  }
}

function serializeFactSnapshot(row: FactRow): DecisionFactSnapshot {
  const fact = mapFact(row)

  return {
    ...fact,
    unit: fact.unit ?? null,
    confirmedByUserId: fact.confirmedByUserId ?? null,
    confirmedAt: fact.confirmedAt?.toISOString() ?? null,
    createdAt: fact.createdAt.toISOString(),
    updatedAt: fact.updatedAt.toISOString(),
  }
}

function deserializeFactSnapshot(snapshot: DecisionFactSnapshot): PropertyFact {
  return {
    ...snapshot,
    unit: snapshot.unit ?? undefined,
    confirmedByUserId: snapshot.confirmedByUserId ?? undefined,
    confirmedAt: snapshot.confirmedAt
      ? new Date(snapshot.confirmedAt)
      : null,
    createdAt: new Date(snapshot.createdAt),
    updatedAt: new Date(snapshot.updatedAt),
  }
}

function isFinalProposalStatus(status: PropertyFactProposal['status']) {
  return ['accepted', 'corrected', 'rejected'].includes(status)
}
