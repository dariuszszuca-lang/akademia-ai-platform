# Property Sources Core — Implementation Plan

> **Execution contract:** implement this plan with `superpowers-executing-plans`,
> in an isolated git worktree, test-first. Do not push or deploy this intermediate
> slice. AWS upload, malware scanning, extraction workers and the final review-desk
> UI are separate vertical slices of the approved M2 design.

**Goal:** Build the tenant-safe data and decision core for property source files:
source records, processing jobs, evidence-backed AI proposals, deterministic
conflict detection, human-only confirmation and an auditable history.

**Architecture:** Keep the existing Property Truth Engine as the authoritative
fact store. Add a separate `property-sources` feature with its own domain,
schema and repository. `PropertySourceService` uses the existing
`PropertyRepository` to authorize access to a property before every user-facing
operation. The PostgreSQL source repository performs proposal decisions and
fact writes in one transaction. The in-memory source repository composes with
the existing in-memory property repository for service and HTTP tests.

**Tech stack:** Next.js 16 App Router, TypeScript, Zod 4, Drizzle ORM,
PostgreSQL/PGlite, Vitest.

**Approved design:**  
`docs/superpowers/specs/2026-07-27-property-sources-extraction-aws-design.md`

## Non-negotiable invariants

1. AI and integrations may create only proposals. They may never create a
   `confirmed` fact.
2. Every proposal stores a source ID, job ID, verbatim evidence fragment and a
   machine-readable locator.
3. A different value for an existing fact key creates a visible conflict. It
   never silently overwrites the current fact.
4. Only an authenticated member of the property's organization can decide a
   proposal.
5. A decision that changes a fact, changes the proposal and writes an audit
   event is one PostgreSQL transaction.
6. Proposal ingestion and decisions are idempotent.
7. All repository reads are scoped by organization and property.
8. Client payloads cannot set organization IDs, storage keys, actor type,
   confirmed user IDs or proposal status.

## Slice boundaries

This plan includes:

- source, job and proposal domain models;
- PostgreSQL schema and migration;
- in-memory and PostgreSQL repositories;
- source registration and job/proposal ingestion service methods;
- conflict detection;
- human proposal decisions;
- authenticated list/decision HTTP endpoints;
- account export of the new records;
- source/proposal/audit counts needed by the next UI slice.

This plan deliberately excludes:

- S3/KMS/OIDC/CDK and pre-signed upload credentials;
- GuardDuty malware scanning;
- EventBridge, Step Functions, Bedrock and Transcribe workers;
- HMAC worker callback endpoints;
- source preview and the final three-column review desk;
- synthetic demo files and E2E benchmark.

Those features depend on this core and will be implemented in the next approved
M2 slices.

## Target file map

### New files

- `src/features/property-sources/domain.ts`
- `src/features/property-sources/domain.test.ts`
- `src/features/property-sources/catalog.ts`
- `src/features/property-sources/catalog.test.ts`
- `src/features/property-sources/schema.ts`
- `src/features/property-sources/schema.test.ts`
- `src/features/property-sources/repository.ts`
- `src/features/property-sources/memory-repository.ts`
- `src/features/property-sources/postgres-repository.ts`
- `src/features/property-sources/postgres-repository.test.ts`
- `src/features/property-sources/service.ts`
- `src/features/property-sources/service.test.ts`
- `src/features/property-sources/http.ts`
- `src/features/property-sources/http.test.ts`
- `src/features/property-sources/server-repository.ts`
- `src/app/api/properties/[propertyId]/sources/route.ts`
- `src/app/api/properties/[propertyId]/proposals/route.ts`
- `src/app/api/properties/[propertyId]/proposals/[proposalId]/decision/route.ts`
- generated migration under `drizzle/`

### Modified files

- `drizzle.config.ts`
- `src/features/properties/repository.ts`
- `src/features/properties/memory-repository.ts`
- `src/features/properties/postgres-repository.ts`
- `src/features/properties/service.ts`
- `src/features/properties/service.test.ts`
- `src/features/properties/account-data.ts`
- `src/features/properties/account-data.test.ts`
- `.env.example` only if a non-secret feature flag is needed; no cloud
  credentials are introduced in this slice.

---

## Task 1: Define the evidence and proposal domain

**Files:**

- Create: `src/features/property-sources/domain.ts`
- Create: `src/features/property-sources/domain.test.ts`

### Step 1: Write failing domain tests

Cover these cases:

```ts
import { describe, expect, it } from 'vitest'
import {
  createPropertySourceSchema,
  evidenceLocatorSchema,
  ingestFactProposalSchema,
  proposalDecisionSchema,
} from './domain'

describe('property source domain', () => {
  it('accepts a page citation with a verbatim evidence fragment', () => {
    expect(
      ingestFactProposalSchema.parse({
        externalKey: 'area-usable-1',
        factKey: 'area.usable',
        label: 'Powierzchnia użytkowa',
        category: 'Powierzchnia',
        valueType: 'number',
        value: 83.4,
        unit: 'm²',
        confidence: 0.98,
        evidenceText: 'Powierzchnia użytkowa: 83,40 m²',
        evidenceLocator: { type: 'page', page: 2 },
      }),
    ).toMatchObject({ factKey: 'area.usable', confidence: 0.98 })
  })

  it.each([
    { type: 'page', page: 0 },
    { type: 'sheet', sheet: '', row: 1, column: 'A' },
    { type: 'time', startMs: 9000, endMs: 1000 },
    { type: 'text', start: 20, end: 10 },
  ])('rejects an invalid locator: %j', (locator) => {
    expect(() => evidenceLocatorSchema.parse(locator)).toThrow()
  })

  it('rejects a proposal without evidence text', () => {
    expect(() =>
      ingestFactProposalSchema.parse({
        externalKey: 'price-1',
        factKey: 'price.asking',
        label: 'Cena ofertowa',
        category: 'Cena',
        valueType: 'money',
        value: 925000,
        confidence: 0.8,
        evidenceText: '',
        evidenceLocator: { type: 'page', page: 1 },
      }),
    ).toThrow()
  })

  it('does not accept actor, status or organization fields from source input', () => {
    const parsed = createPropertySourceSchema.parse({
      fileName: 'operat.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 1200,
      checksumSha256: 'a'.repeat(64),
      actorType: 'ai',
      status: 'ready',
      organizationId: 'forged-org',
    })

    expect(parsed).not.toHaveProperty('actorType')
    expect(parsed).not.toHaveProperty('status')
    expect(parsed).not.toHaveProperty('organizationId')
  })

  it('requires a corrected value for correct_and_accept', () => {
    expect(() =>
      proposalDecisionSchema.parse({ action: 'correct_and_accept' }),
    ).toThrow()
  })
})
```

### Step 2: Run the test and confirm the expected failure

Run:

```bash
npm test -- src/features/property-sources/domain.test.ts
```

Expected: FAIL because `./domain` does not exist.

### Step 3: Implement the domain

Create:

```ts
import { z } from 'zod'
import { propertyFactValueTypeSchema } from '../properties/domain'

export const propertySourceStatuses = [
  'upload_pending',
  'uploaded',
  'scanning',
  'quarantined',
  'queued',
  'processing',
  'review_ready',
  'failed',
  'deleted',
] as const

export const sourceJobStatuses = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
] as const

export const factProposalStatuses = [
  'pending',
  'conflict',
  'accepted',
  'corrected',
  'rejected',
  'needs_review',
] as const

export const supportedSourceMediaTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
] as const

const pageLocatorSchema = z.object({
  type: z.literal('page'),
  page: z.number().int().positive(),
})

const sheetLocatorSchema = z.object({
  type: z.literal('sheet'),
  sheet: z.string().trim().min(1).max(120),
  row: z.number().int().positive(),
  column: z.string().trim().regex(/^[A-Z]{1,3}$/),
})

const timeLocatorSchema = z
  .object({
    type: z.literal('time'),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
  })
  .refine((value) => value.endMs > value.startMs, {
    message: 'Koniec fragmentu musi być później niż początek.',
  })

const textLocatorSchema = z
  .object({
    type: z.literal('text'),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  })
  .refine((value) => value.end > value.start, {
    message: 'Koniec fragmentu musi być później niż początek.',
  })

export const evidenceLocatorSchema = z.discriminatedUnion('type', [
  pageLocatorSchema,
  sheetLocatorSchema,
  timeLocatorSchema,
  textLocatorSchema,
])

export const createPropertySourceSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    mediaType: z.enum(supportedSourceMediaTypes),
    sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  })
  .strip()

export const ingestFactProposalSchema = z.object({
  externalKey: z.string().trim().min(1).max(160),
  factKey: z
    .string()
    .trim()
    .regex(/^[a-z][a-zA-Z0-9._-]*$/)
    .max(100),
  label: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(80),
  valueType: propertyFactValueTypeSchema,
  value: z.unknown(),
  unit: z.string().trim().max(30).optional(),
  confidence: z.number().min(0).max(1),
  evidenceText: z.string().trim().min(1).max(4000),
  evidenceLocator: evidenceLocatorSchema,
})

export const proposalDecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accept') }),
  z.object({
    action: z.literal('correct_and_accept'),
    value: z.unknown(),
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal('reject'),
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal('keep_existing'),
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal('accept_new') }),
  z.object({
    action: z.literal('keep_open'),
    note: z.string().trim().max(1000).optional(),
  }),
])

export type EvidenceLocator = z.infer<typeof evidenceLocatorSchema>
export type CreatePropertySourceInput = z.infer<
  typeof createPropertySourceSchema
>
export type IngestFactProposalInput = z.infer<
  typeof ingestFactProposalSchema
>
export type ProposalDecision = z.infer<typeof proposalDecisionSchema>
export type PropertySourceStatus = (typeof propertySourceStatuses)[number]
export type SourceJobStatus = (typeof sourceJobStatuses)[number]
export type FactProposalStatus = (typeof factProposalStatuses)[number]

export type PropertySource = CreatePropertySourceInput & {
  id: string
  organizationId: string
  propertyProjectId: string
  storageKey: string
  status: PropertySourceStatus
  errorCode: string | null
  errorMessage: string | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
}

export type SourceProcessingJob = {
  id: string
  organizationId: string
  propertyProjectId: string
  sourceId: string
  idempotencyKey: string
  status: SourceJobStatus
  attempt: number
  modelId: string | null
  inputTokens: number | null
  outputTokens: number | null
  estimatedCostUsd: string | null
  errorCode: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type PropertyFactProposal = IngestFactProposalInput & {
  id: string
  organizationId: string
  propertyProjectId: string
  sourceId: string
  jobId: string
  status: FactProposalStatus
  conflictsWithFactId: string | null
  decidedByUserId: string | null
  decisionNote: string | null
  decidedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

The implementation may extract reusable validation helpers, but the public
values and invariants above must remain stable.

### Step 4: Run the test

Run:

```bash
npm test -- src/features/property-sources/domain.test.ts
```

Expected: PASS.

### Step 5: Commit

```bash
git add src/features/property-sources/domain.ts \
  src/features/property-sources/domain.test.ts
git commit -m "feat: define property source evidence domain"
```

---

## Task 2: Add a bounded property fact catalog

**Files:**

- Create: `src/features/property-sources/catalog.ts`
- Create: `src/features/property-sources/catalog.test.ts`

### Step 1: Write failing tests

Test that:

- common keys such as `price.asking`, `area.usable`, `rooms.count`,
  `legal.landRegisterNumber` and `plot.area` resolve to a definition;
- `plot.area` applies to a plot but not an apartment;
- an unknown key is rejected by the extraction catalog;
- the returned label, category, value type and unit come from the catalog, not
  from the model payload.

Use this test shape:

```ts
expect(resolveFactDefinition('plot.area', 'plot')).toMatchObject({
  valueType: 'number',
  unit: 'm²',
})
expect(resolveFactDefinition('plot.area', 'apartment')).toBeNull()
expect(resolveFactDefinition('made.up.key', 'house')).toBeNull()
```

### Step 2: Run and confirm failure

```bash
npm test -- src/features/property-sources/catalog.test.ts
```

Expected: FAIL because `catalog.ts` does not exist.

### Step 3: Implement the catalog

Define a readonly array with at least these initial keys:

```ts
[
  'price.asking',
  'price.currency',
  'area.usable',
  'area.total',
  'rooms.count',
  'floor.number',
  'building.floors',
  'building.yearBuilt',
  'building.type',
  'condition',
  'legal.landRegisterNumber',
  'legal.ownershipType',
  'legal.encumbrances',
  'plot.area',
  'plot.identifier',
  'plot.shape',
  'plot.utilities',
  'plot.accessRoad',
  'energy.heatingType',
  'energy.certificateClass',
]
```

Each definition contains:

```ts
type FactDefinition = {
  key: string
  label: string
  category: string
  valueType: PropertyFact['valueType']
  unit?: string
  propertyTypes: readonly PropertyProject['propertyType'][]
}
```

Export:

```ts
export function resolveFactDefinition(
  key: string,
  propertyType: PropertyProject['propertyType'],
): FactDefinition | null
```

The ingestion service must later replace model-provided label/category/type/unit
with this trusted definition.

### Step 4: Run and commit

```bash
npm test -- src/features/property-sources/catalog.test.ts
git add src/features/property-sources/catalog.ts \
  src/features/property-sources/catalog.test.ts
git commit -m "feat: add trusted property extraction catalog"
```

Expected: PASS, then a clean commit.

---

## Task 3: Add PostgreSQL tables and migration

**Files:**

- Create: `src/features/property-sources/schema.ts`
- Create: `src/features/property-sources/schema.test.ts`
- Modify: `drizzle.config.ts`
- Generate: `drizzle/0001_*.sql`
- Modify generated: `drizzle/meta/_journal.json`
- Generate: `drizzle/meta/0001_snapshot.json`

### Step 1: Write a failing schema contract test

The test must assert:

- source table exposes organization, project, storage key, status and checksum;
- job table exposes source, idempotency key, status and cost fields;
- proposal table exposes evidence, locator, conflict and decision fields;
- callback nonce table exists now so the later worker callback can be added
  without another core migration;
- all user/AI-controlled state columns are non-null where required.

Use Drizzle metadata rather than string snapshots where possible:

```ts
expect(propertySources.organizationId.notNull).toBe(true)
expect(propertySources.storageKey.notNull).toBe(true)
expect(sourceProcessingJobs.idempotencyKey.notNull).toBe(true)
expect(propertyFactProposals.evidenceText.notNull).toBe(true)
expect(extractionCallbackNonces.nonce.notNull).toBe(true)
```

### Step 2: Run and confirm failure

```bash
npm test -- src/features/property-sources/schema.test.ts
```

Expected: FAIL because `schema.ts` does not exist.

### Step 3: Implement the schema

Create enums:

```ts
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
```

Create these tables and constraints:

1. `property_sources`

   - UUID primary key;
   - organization and project foreign keys with cascade deletion;
   - private `storage_key`;
   - original filename, trusted media type, byte size and SHA-256 checksum;
   - processing status and sanitized error fields;
   - creator and timestamps;
   - unique `(property_project_id, storage_key)`;
   - indexes `(organization_id, property_project_id, created_at)` and
     `(property_project_id, status)`.

2. `property_source_processing_jobs`

   - UUID primary key;
   - organization, project and source foreign keys;
   - globally unique `idempotency_key`;
   - status, attempt, model, token and decimal cost fields;
   - sanitized error code and lifecycle timestamps;
   - index `(source_id, created_at)`.

3. `property_fact_proposals`

   - UUID primary key;
   - organization, project, source and job foreign keys;
   - `external_key`, fact key, trusted metadata and JSON value;
   - confidence as a decimal or double precision value constrained to 0..1;
   - evidence text and typed JSON locator;
   - status and nullable `conflicts_with_fact_id`;
   - decision user, note and timestamp;
   - unique `(job_id, external_key)`;
   - indexes `(property_project_id, status, created_at)` and
     `(source_id, created_at)`.

4. `extraction_callback_nonces`

   - nonce text primary key;
   - job foreign key;
   - expiry and used timestamps;
   - index on expiry for cleanup.

Use references from `../properties/schema`. No organization or project
identifier may be stored without a corresponding foreign key.

### Step 4: Include both schema files in Drizzle

Change:

```ts
schema: [
  './src/features/properties/schema.ts',
  './src/features/property-sources/schema.ts',
],
```

### Step 5: Generate and inspect the migration

```bash
npm run db:generate -- --name property_sources_core
rg -n "property_sources|property_source_processing_jobs|property_fact_proposals|extraction_callback_nonces" drizzle
```

Expected: one new migration containing all four tables, enums, foreign keys and
indexes. Ensure it contains no destructive changes to the existing property
tables.

### Step 6: Run tests

```bash
npm test -- src/features/property-sources/schema.test.ts \
  src/features/properties/schema.test.ts
```

Expected: PASS.

### Step 7: Commit

```bash
git add drizzle.config.ts drizzle \
  src/features/property-sources/schema.ts \
  src/features/property-sources/schema.test.ts
git commit -m "feat: add property source persistence schema"
```

---

## Task 4: Define repositories and source registration

**Files:**

- Create: `src/features/property-sources/repository.ts`
- Create: `src/features/property-sources/memory-repository.ts`
- Create: `src/features/property-sources/service.ts`
- Create: `src/features/property-sources/service.test.ts`
- Modify: `src/features/properties/repository.ts`
- Modify: `src/features/properties/memory-repository.ts`
- Modify: `src/features/properties/postgres-repository.ts`
- Modify: `src/features/properties/service.ts`
- Modify: `src/features/properties/service.test.ts`

### Step 1: Add audit-history support to the existing property repository

First add failing tests:

- user A can list audit records for their property;
- user B gets `PROPERTY_NOT_FOUND` through the service;
- records are newest-first.

Add to `PropertyRepository`:

```ts
listAudit(userId: string, projectId: string): Promise<AuditRecord[]>
```

Add to `PropertyService`:

```ts
async listAudit(userId: string, projectId: string) {
  await this.getProject(userId, projectId)
  return this.repository.listAudit(userId, projectId)
}
```

Implement it in memory and PostgreSQL with membership and project scoping.

Run:

```bash
npm test -- src/features/properties/service.test.ts \
  src/features/properties/postgres-repository.test.ts
```

Expected: initial FAIL, then PASS.

### Step 2: Write failing source-service tests

The tests must create two users and two properties. Cover:

- source ID is generated by the service;
- storage key is generated as
  `organizations/<org>/properties/<property>/sources/<source>/original`;
- client cannot supply or replace organization/storage/status;
- source starts at `upload_pending`;
- duplicate checksum is allowed as a separate source at core level because the
  later upload service decides whether to deduplicate;
- user B cannot list or register a source for user A's property;
- `listSources` returns newest-first.

Use a factory:

```ts
const propertyRepository = new MemoryPropertyRepository()
const sourceRepository = new MemoryPropertySourceRepository(
  propertyRepository,
)
const propertyService = new PropertyService(propertyRepository)
const sourceService = new PropertySourceService(
  propertyRepository,
  sourceRepository,
)
```

### Step 3: Run and confirm failure

```bash
npm test -- src/features/property-sources/service.test.ts
```

Expected: FAIL because the repository and service do not exist.

### Step 4: Define the repository contract

The source repository must expose:

```ts
export interface PropertySourceRepository {
  createSource(
    record: NewPropertySourceRecord,
  ): Promise<PropertySource>
  listSources(
    organizationId: string,
    propertyProjectId: string,
  ): Promise<PropertySource[]>
  getSource(
    organizationId: string,
    propertyProjectId: string,
    sourceId: string,
  ): Promise<PropertySource | null>
  getSourceInternal(sourceId: string): Promise<PropertySource | null>
  updateSourceStatusInternal(
    sourceId: string,
    update: SourceStatusUpdate,
  ): Promise<PropertySource | null>
  createJobInternal(
    record: NewSourceJobRecord,
  ): Promise<SourceProcessingJob>
  getJobByIdempotencyKeyInternal(
    idempotencyKey: string,
  ): Promise<SourceProcessingJob | null>
  listJobs(
    organizationId: string,
    propertyProjectId: string,
  ): Promise<SourceProcessingJob[]>
  ingestProposalsInternal(
    context: ProposalIngestionContext,
    proposals: TrustedProposalInput[],
  ): Promise<PropertyFactProposal[]>
  listProposals(
    organizationId: string,
    propertyProjectId: string,
    filter?: ProposalListFilter,
  ): Promise<PropertyFactProposal[]>
  decideProposal(
    command: DecideProposalCommand,
  ): Promise<ProposalDecisionResult>
  exportForUser(userId: string): Promise<PropertySourcesExport>
}
```

Trusted record/command types carry organization and project IDs and are not
exported from HTTP parsing modules.

### Step 5: Implement source registration

`PropertySourceService.registerSource` must:

1. authorize the property with `PropertyRepository.getProject`;
2. parse only filename, media type, size and checksum;
3. generate the source UUID with `crypto.randomUUID()`;
4. derive the storage key from trusted project and source IDs;
5. create a record with `upload_pending`;
6. append a `source.registered` audit event with actor type `user`;
7. return the source.

`listSources` and `getSource` authorize the property first, then use
organization-scoped source repository methods.

### Step 6: Implement in-memory storage

The in-memory repository holds private arrays for sources, jobs and proposals.
It receives the existing `MemoryPropertyRepository` only for decision tests;
user authorization remains in the service. Clone all returned records so tests
cannot mutate repository state.

### Step 7: Run tests and commit

```bash
npm test -- src/features/properties/service.test.ts \
  src/features/properties/postgres-repository.test.ts \
  src/features/property-sources/service.test.ts
git add src/features/properties \
  src/features/property-sources/repository.ts \
  src/features/property-sources/memory-repository.ts \
  src/features/property-sources/service.ts \
  src/features/property-sources/service.test.ts
git commit -m "feat: register tenant scoped property sources"
```

Expected: PASS.

---

## Task 5: Ingest jobs and evidence-backed proposals idempotently

**Files:**

- Modify: `src/features/property-sources/service.ts`
- Modify: `src/features/property-sources/service.test.ts`
- Modify: `src/features/property-sources/memory-repository.ts`

### Step 1: Write failing tests

Cover:

1. `createProcessingJobInternal` returns the same job for the same
   idempotency key.
2. A proposal for a missing fact key has `pending` status.
3. A proposal equal to the current fact value has `pending` status.
4. A proposal with a different value has `conflict` status and points to the
   existing fact ID.
5. Ingesting the same `(jobId, externalKey)` twice returns the existing
   proposal and creates no duplicate.
6. Unknown catalog keys are rejected and no partial proposals remain.
7. The trusted catalog replaces model-supplied label/category/type/unit.
8. Every stored proposal contains evidence text and locator.
9. An internal job cannot ingest proposals for a different source or project.

### Step 2: Run and confirm failure

```bash
npm test -- src/features/property-sources/service.test.ts
```

Expected: FAIL on missing job/ingestion behavior.

### Step 3: Implement trusted ingestion

Add internal service methods:

```ts
createProcessingJobInternal(raw: {
  sourceId: string
  idempotencyKey: string
  attempt: number
}): Promise<SourceProcessingJob>

ingestProposalsInternal(raw: {
  sourceId: string
  jobId: string
  proposals: unknown[]
}): Promise<PropertyFactProposal[]>
```

For each parsed proposal:

1. load the source and its property;
2. resolve a trusted catalog definition for the property's type;
3. compare the normalized proposed value to the current fact value;
4. set `pending` or `conflict`;
5. attach the current fact ID for conflicts;
6. insert by `(jobId, externalKey)` using idempotent semantics;
7. append one `proposal.created` audit event per newly created proposal with
   actor type `ai` and actor ID equal to the job/model identity;
8. never write a property fact.

Use one stable value comparator shared by memory and PostgreSQL:

```ts
export function propertyFactValuesEqual(left: unknown, right: unknown) {
  return stableJson(left) === stableJson(right)
}
```

`stableJson` must recursively sort object keys, preserve array order and handle
JSON-compatible primitives.

### Step 4: Run tests and commit

```bash
npm test -- src/features/property-sources/service.test.ts
git add src/features/property-sources
git commit -m "feat: ingest evidence backed fact proposals"
```

Expected: PASS.

---

## Task 6: Implement human decisions and conflict resolution

**Files:**

- Modify: `src/features/property-sources/repository.ts`
- Modify: `src/features/property-sources/memory-repository.ts`
- Modify: `src/features/property-sources/service.ts`
- Modify: `src/features/property-sources/service.test.ts`

### Step 1: Write failing decision tests

Cover every state transition:

- `accept` on a non-conflict creates or updates a confirmed fact;
- the fact records the source ID and authenticated decision user;
- `correct_and_accept` uses the user's corrected value;
- `reject` leaves facts unchanged;
- `keep_existing` rejects a conflict and leaves the current fact unchanged;
- `accept_new` replaces the current value, increments version and confirms it;
- `keep_open` marks the current fact as conflicting and keeps the proposal in
  `needs_review`;
- `accept` is rejected for a conflict; user must choose a conflict action;
- non-conflict actions are rejected for non-conflict proposals where invalid;
- a user cannot decide another tenant's proposal;
- a decided proposal returns the original result on an identical retry;
- a different second decision returns `PROPOSAL_ALREADY_DECIDED`;
- audit events never use actor type `ai` for a decision.

### Step 2: Run and confirm failure

```bash
npm test -- src/features/property-sources/service.test.ts
```

Expected: FAIL on missing decision behavior.

### Step 3: Implement decision guards in the service

`decideProposal(userId, projectId, proposalId, rawDecision)` must:

1. authorize the property;
2. parse the decision;
3. reject invalid action/status combinations;
4. pass a trusted command containing the authenticated user and organization
   to the repository;
5. return proposal and optional fact.

The service must not accept client-supplied `confirmedByUserId`, source IDs,
fact key, actor type or proposal status.

### Step 4: Implement memory decision behavior

For the test double:

- use the existing property repository's public fact methods;
- update proposal state only after fact mutation succeeds;
- append a `proposal.decided` audit record;
- store a deterministic decision fingerprint for idempotent retry.

The PostgreSQL implementation in the next task is the authoritative atomic
implementation.

### Step 5: Run and commit

```bash
npm test -- src/features/property-sources/service.test.ts
git add src/features/property-sources
git commit -m "feat: add human proposal decisions"
```

Expected: PASS.

---

## Task 7: Implement the transactional PostgreSQL repository

**Files:**

- Create: `src/features/property-sources/postgres-repository.ts`
- Create: `src/features/property-sources/postgres-repository.test.ts`
- Create: `src/features/property-sources/server-repository.ts`
- Modify: `src/lib/db/client.ts` only if the schema needs to be exported to
  Drizzle query helpers.

### Step 1: Write failing PGlite repository tests

Use the same migration harness as
`src/features/properties/postgres-repository.test.ts`.

Cover:

- create/list/get source within the right organization/property;
- no cross-tenant source/proposal visibility;
- idempotent job creation under a unique idempotency key;
- idempotent proposal ingestion under `(jobId, externalKey)`;
- conflict detection against an existing fact;
- all six decision actions;
- acceptance updates proposal, fact and audit together;
- forced fact-write failure rolls back the proposal decision;
- two concurrent decisions yield one success and one stable
  `PROPOSAL_ALREADY_DECIDED`;
- source/job/proposal rows cascade when the property is deleted.

### Step 2: Run and confirm failure

```bash
npm test -- src/features/property-sources/postgres-repository.test.ts
```

Expected: FAIL because the PostgreSQL implementation does not exist.

### Step 3: Implement scoped queries

All user-facing queries must include both:

- expected `organizationId`;
- expected `propertyProjectId`.

Do not authorize with only a source/proposal UUID.

For idempotent inserts use PostgreSQL conflict handling:

```ts
.onConflictDoNothing({
  target: [
    propertyFactProposals.jobId,
    propertyFactProposals.externalKey,
  ],
})
```

Then select the existing row in the same scope.

### Step 4: Implement transactional decisions

Inside `database.transaction`:

1. select the proposal scoped by organization and project;
2. lock or conditionally update it only while status is `pending`, `conflict`
   or `needs_review`;
3. load the current fact by `(propertyProjectId, factKey)`;
4. perform the action-specific fact insert/update;
5. merge the source ID without duplicates;
6. set `confirmedByUserId` and `confirmedAt` only for accepted values;
7. update proposal decision fields;
8. insert `proposal.decided` into `property_audit_events`;
9. return the committed proposal and fact.

Prefer conditional updates with the previous status in the `WHERE` clause so
concurrent requests cannot both win.

Never interpolate identifiers or values into SQL strings.

### Step 5: Wire the server repository

Export a singleton:

```ts
export const propertySourceRepository =
  new PostgresPropertySourceRepository(database)
```

Do not read or print `DATABASE_URL`.

### Step 6: Run tests and commit

```bash
npm test -- src/features/property-sources/postgres-repository.test.ts \
  src/features/property-sources/service.test.ts
git add src/features/property-sources src/lib/db/client.ts
git commit -m "feat: persist property source reviews transactionally"
```

Expected: PASS.

---

## Task 8: Add authenticated list and decision HTTP endpoints

**Files:**

- Create: `src/features/property-sources/http.ts`
- Create: `src/features/property-sources/http.test.ts`
- Create: `src/app/api/properties/[propertyId]/sources/route.ts`
- Create: `src/app/api/properties/[propertyId]/proposals/route.ts`
- Create:
  `src/app/api/properties/[propertyId]/proposals/[proposalId]/decision/route.ts`

### Step 1: Write failing HTTP tests

Test handlers directly with injected authentication and service dependencies:

- unauthenticated list returns 401;
- invalid IDs/payload return 400 with no internals;
- source list returns only the authenticated tenant's sources;
- proposal list supports `status=pending` and `status=conflict`;
- invalid status filter returns 400;
- decision returns 200;
- missing property/proposal returns 404;
- already-decided conflict returns 409;
- cross-tenant access returns 404, not 403, to avoid resource enumeration;
- response errors never include stack traces, SQL or environment values.

### Step 2: Run and confirm failure

```bash
npm test -- src/features/property-sources/http.test.ts
```

Expected: FAIL because HTTP handlers do not exist.

### Step 3: Implement handler factories

Follow the dependency-injection style in
`src/features/properties/http.ts`.

Export:

```ts
createListPropertySourcesHandler(dependencies)
createListPropertyProposalsHandler(dependencies)
createDecidePropertyProposalHandler(dependencies)
```

Map errors:

```ts
PROPERTY_NOT_FOUND -> 404
SOURCE_NOT_FOUND -> 404
PROPOSAL_NOT_FOUND -> 404
PROPOSAL_ALREADY_DECIDED -> 409
INVALID_PROPOSAL_DECISION -> 409
ZodError -> 400
default -> 500 with a generic Polish message
```

Use the existing auth session resolver; do not create a second auth system.

### Step 4: Wire App Router routes

Route modules only:

1. await route params;
2. construct the server service from the existing property repository and new
   source repository;
3. delegate to the handler.

No business logic belongs in route modules.

### Step 5: Run tests and commit

```bash
npm test -- src/features/property-sources/http.test.ts \
  src/features/properties/http.test.ts
git add src/features/property-sources/http.ts \
  src/features/property-sources/http.test.ts \
  src/app/api/properties
git commit -m "feat: expose property source review api"
```

Expected: PASS.

---

## Task 9: Extend GDPR export without weakening deletion

**Files:**

- Modify: `src/features/properties/account-data.ts`
- Modify: `src/features/properties/account-data.test.ts`
- Modify: `src/features/property-sources/repository.ts`
- Modify: `src/features/property-sources/memory-repository.ts`
- Modify: `src/features/property-sources/postgres-repository.ts`

### Step 1: Write failing account-data tests

Cover:

- export contains `sources`, `jobs` and `proposals`;
- user A export contains no records from user B;
- proposal evidence and decisions are exported;
- deleting the account still removes all database rows through existing
  organization cascades;
- the exported shape stays backward compatible under `propertyStudio`.

Expected shape:

```ts
{
  propertyStudio: {
    projects: [],
    facts: [],
    audit: [],
    sources: [],
    sourceJobs: [],
    factProposals: [],
  }
}
```

### Step 2: Run and confirm failure

```bash
npm test -- src/features/properties/account-data.test.ts
```

Expected: FAIL because source data is absent.

### Step 3: Add dependency-injected source export

Extend account export dependencies with:

```ts
exportSourcesForUser(userId: string): Promise<PropertySourcesExport>
```

Merge the result under `propertyStudio`.

Do not add S3 deletion here yet. The AWS storage slice will add object purge
before the existing database cascade, with a retryable deletion job. This core
slice must preserve current database deletion behavior.

### Step 4: Run and commit

```bash
npm test -- src/features/properties/account-data.test.ts \
  src/features/property-sources/postgres-repository.test.ts
git add src/features/properties/account-data.ts \
  src/features/properties/account-data.test.ts \
  src/features/property-sources
git commit -m "feat: include property sources in account export"
```

Expected: PASS.

---

## Task 10: Verify the complete core slice

### Step 1: Run targeted tests

```bash
npm test -- \
  src/features/property-sources/domain.test.ts \
  src/features/property-sources/catalog.test.ts \
  src/features/property-sources/schema.test.ts \
  src/features/property-sources/service.test.ts \
  src/features/property-sources/postgres-repository.test.ts \
  src/features/property-sources/http.test.ts \
  src/features/properties/service.test.ts \
  src/features/properties/postgres-repository.test.ts \
  src/features/properties/account-data.test.ts
```

Expected: PASS.

### Step 2: Run the full quality gate

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected:

- all tests pass;
- TypeScript exits 0;
- ESLint exits 0;
- production build exits 0 and lists the three new API routes.

### Step 3: Inspect migration safety and repository diff

```bash
git diff --check
git status --short
git diff --stat main...HEAD
rg -n "(AKIA|ASIA|aws_secret_access_key|BEGIN (RSA|OPENSSH) PRIVATE KEY|DATABASE_URL=.+)" \
  --glob '!package-lock.json' .
```

Expected:

- no whitespace errors;
- only files named in this plan plus generated migration metadata;
- no secrets or credential values.

### Step 4: Review invariants manually

Confirm from tests and code:

- no AI code path writes a confirmed fact;
- every proposal has evidence and locator;
- conflict does not overwrite;
- decision is transactional in PostgreSQL;
- tenant access is scoped;
- idempotency constraints exist in both schema and code.

### Step 5: Commit any verification-only fixes

If verification required code changes, add a focused test first, make the fix
and commit:

```bash
git add <only-the-files-changed-for-the-fix>
git commit -m "fix: harden property source review core"
```

Do not create an empty commit.

### Step 6: Handoff to the next slice

Record:

- worktree branch and head commit;
- exact test counts;
- generated migration filename;
- open risks, if any;
- no deployment performed.

The next plan must implement AWS storage and direct upload on top of
`registerSource`, without changing the domain decisions proven by this slice.
