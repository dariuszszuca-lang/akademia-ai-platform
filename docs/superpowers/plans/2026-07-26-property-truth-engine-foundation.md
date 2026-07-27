# Property Truth Engine Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zbudować pierwszy działający pionowy wycinek Property Intelligence Studio: prywatne portfolio nieruchomości, paszport faktów, statusy wiarygodności i historię zmian.

**Architecture:** Istniejący Next.js i Cognito pozostają warstwą aplikacji oraz tożsamości. Dane domenowe trafiają do PostgreSQL przez Drizzle ORM, a logika biznesowa jest oddzielona od tras i UI za pomocą repozytorium oraz serwisu. Każde zapytanie jest ograniczane członkostwem użytkownika w organizacji, a każda zmiana faktu tworzy wpis audytowy.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict, PostgreSQL, Drizzle ORM, Zod, Vitest, istniejąca sesja Cognito.

---

## Zakres tego planu

Plan realizuje wyłącznie fundament opisany jako `MVP 1 — Property Truth Engine` w
`docs/specs/2026-07-26-property-intelligence-studio.md`.

Nie obejmuje uploadu plików, ekstrakcji AI, Plot Future Lab, generowania mediów,
Buyer Room ani integracji z Keller Williams Command. Każdy z tych elementów
powinien dostać osobny plan po potwierdzeniu modelu danych na prawdziwych
teczkach nieruchomości.

## Struktura plików

### Pliki nowe

- `vitest.config.ts` — konfiguracja testów jednostkowych.
- `drizzle.config.ts` — konfiguracja migracji PostgreSQL.
- `src/lib/db/client.ts` — pojedyncze połączenie serwerowe z bazą.
- `src/features/properties/domain.ts` — typy, statusy i walidacja domeny.
- `src/features/properties/domain.test.ts` — testy reguł faktów i projektów.
- `src/features/properties/schema.ts` — tabele Drizzle.
- `src/features/properties/repository.ts` — kontrakt repozytorium.
- `src/features/properties/postgres-repository.ts` — implementacja PostgreSQL.
- `src/features/properties/memory-repository.ts` — repozytorium do testów.
- `src/features/properties/service.ts` — reguły autoryzacji i audytu.
- `src/features/properties/service.test.ts` — test izolacji oraz zmian.
- `src/app/api/properties/route.ts` — lista i tworzenie nieruchomości.
- `src/app/api/properties/[propertyId]/route.ts` — odczyt i edycja projektu.
- `src/app/api/properties/[propertyId]/facts/route.ts` — lista i dodawanie faktów.
- `src/app/api/properties/[propertyId]/facts/[factId]/route.ts` — zmiana faktu.
- `src/app/(dashboard)/nieruchomosci/page.tsx` — portfolio.
- `src/app/(dashboard)/nieruchomosci/NewPropertyForm.tsx` — formularz projektu.
- `src/app/(dashboard)/nieruchomosci/PropertyCard.tsx` — karta projektu.
- `src/app/(dashboard)/nieruchomosci/[propertyId]/page.tsx` — workspace projektu.
- `src/app/(dashboard)/nieruchomosci/[propertyId]/AddFactForm.tsx` — formularz faktu.
- `src/app/(dashboard)/nieruchomosci/[propertyId]/FactsBoard.tsx` — paszport.

### Pliki modyfikowane

- `package.json` — zależności i skrypty testów oraz migracji.
- `.env.example` — nazwa wymaganej zmiennej połączenia bez sekretu.
- `src/components/Navbar.tsx` — wejście do portfolio.
- `src/app/(dashboard)/start/page.tsx` — główne CTA do Studio.
- `src/app/api/account/export/route.ts` — dane nieruchomości w eksporcie.
- `src/app/api/account/delete/route.ts` — usunięcie danych nowego modułu.
- `docs/SECURITY.md` — aktualizacja modelu przechowywania i RODO.

## Task 1: Test runner i zależności domenowe

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Dodaj zależności aplikacyjne i developerskie**

Run:

```bash
npm install drizzle-orm postgres zod
npm install -D drizzle-kit vitest
```

Expected: `package.json` oraz `package-lock.json` zawierają nowe pakiety, a
instalacja kończy się kodem 0.

- [ ] **Step 2: Dodaj skrypty bez usuwania istniejących**

W `package.json` ustaw sekcję `scripts`:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate"
}
```

- [ ] **Step 3: Utwórz konfigurację Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    clearMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Dodaj nazwę zmiennej bazy bez wartości produkcyjnej**

Append to `.env.example`:

```dotenv

# Property Intelligence Studio — PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/property_studio
```

- [ ] **Step 5: Sprawdź pusty zestaw testów**

Run:

```bash
npm test
```

Expected: Vitest uruchamia się poprawnie i informuje o braku testów. Jeżeli
zwraca kod 1 z powodu braku testów, przejdź bezpośrednio do Task 2 i ponów
komendę po utworzeniu pierwszego pliku testowego.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts .env.example
git commit -m "chore: add property studio test and database tooling"
```

## Task 2: Model domenowy nieruchomości i faktów

**Files:**
- Create: `src/features/properties/domain.test.ts`
- Create: `src/features/properties/domain.ts`

- [ ] **Step 1: Napisz testy walidacji**

Create `src/features/properties/domain.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  createPropertySchema,
  createPropertyFactSchema,
  updatePropertyFactSchema,
} from './domain'

describe('createPropertySchema', () => {
  it('accepts the minimum private listing', () => {
    const parsed = createPropertySchema.parse({
      title: 'Mieszkanie Jeżyce',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })

    expect(parsed.stage).toBe('draft')
    expect(parsed.address).toBeUndefined()
  })

  it('rejects an exact address without address value', () => {
    const parsed = createPropertySchema.safeParse({
      title: 'Mieszkanie Jeżyce',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'exact',
    })

    expect(parsed.success).toBe(false)
  })
})

describe('property facts', () => {
  it('requires evidence or a confirming user for confirmed status', () => {
    const parsed = createPropertyFactSchema.safeParse({
      key: 'usableArea',
      label: 'Powierzchnia użytkowa',
      category: 'areas',
      valueType: 'number',
      value: 52.4,
      unit: 'm2',
      status: 'confirmed',
      visibility: 'public',
    })

    expect(parsed.success).toBe(false)
  })

  it('accepts an owner declaration without confirmation', () => {
    const parsed = createPropertyFactSchema.parse({
      key: 'monthlyFees',
      label: 'Opłaty miesięczne',
      category: 'costs',
      valueType: 'money',
      value: 820,
      unit: 'PLN',
      status: 'declared',
      visibility: 'client',
      sourceIds: ['source-owner-statement'],
    })

    expect(parsed.status).toBe('declared')
  })

  it('does not allow AI to confirm its own inference', () => {
    const parsed = updatePropertyFactSchema.safeParse({
      status: 'confirmed',
      actorType: 'ai',
      sourceIds: [],
    })

    expect(parsed.success).toBe(false)
  })
})
```

- [ ] **Step 2: Uruchom test i potwierdź błąd**

Run:

```bash
npm test -- src/features/properties/domain.test.ts
```

Expected: FAIL, ponieważ moduł `./domain` nie istnieje.

- [ ] **Step 3: Zaimplementuj typy i schematy**

Create `src/features/properties/domain.ts`:

```ts
import { z } from 'zod'

export const propertyTypes = [
  'apartment',
  'house',
  'plot',
  'commercial',
  'premises',
  'other',
] as const

export const transactionTypes = ['sale', 'rent'] as const

export const propertyStages = [
  'draft',
  'collecting',
  'verification',
  'ready',
  'marketing',
  'under_offer',
  'closed',
  'archived',
] as const

export const addressModes = ['exact', 'approximate', 'hidden'] as const

export const propertyFactStatuses = [
  'confirmed',
  'declared',
  'inferred',
  'conflicting',
  'missing',
  'not_applicable',
] as const

export const propertyFactVisibilities = ['internal', 'client', 'public'] as const
export const actorTypes = ['user', 'ai', 'integration'] as const

export const createPropertySchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    propertyType: z.enum(propertyTypes),
    transactionType: z.enum(transactionTypes),
    stage: z.enum(propertyStages).default('draft'),
    city: z.string().trim().min(2).max(100),
    district: z.string().trim().max(100).optional(),
    addressMode: z.enum(addressModes),
    address: z.string().trim().max(240).optional(),
    plotIdentifier: z.string().trim().max(120).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.addressMode === 'exact' && !value.address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['address'],
        message: 'Dokładny adres jest wymagany dla trybu exact.',
      })
    }
  })

export const updatePropertySchema = createPropertySchema
  .omit({ propertyType: true, transactionType: true })
  .partial()

const factBaseSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-zA-Z0-9._-]*$/).max(100),
  label: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(80),
  valueType: z.enum(['text', 'number', 'money', 'boolean', 'date', 'json']),
  value: z.unknown(),
  unit: z.string().trim().max(30).optional(),
  status: z.enum(propertyFactStatuses),
  visibility: z.enum(propertyFactVisibilities).default('internal'),
  sourceIds: z.array(z.string().min(1)).default([]),
  confirmedByUserId: z.string().min(1).optional(),
})

export const createPropertyFactSchema = factBaseSchema.superRefine((value, ctx) => {
  if (
    value.status === 'confirmed' &&
    value.sourceIds.length === 0 &&
    !value.confirmedByUserId
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['status'],
      message: 'Potwierdzony fakt wymaga źródła albo potwierdzenia użytkownika.',
    })
  }
})

export const updatePropertyFactSchema = factBaseSchema
  .partial()
  .extend({
    actorType: z.enum(actorTypes),
  })
  .superRefine((value, ctx) => {
    if (
      value.status === 'confirmed' &&
      value.actorType !== 'user' &&
      (value.sourceIds?.length ?? 0) === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'AI ani integracja nie mogą samodzielnie potwierdzić faktu.',
      })
    }
  })

export type CreatePropertyInput = z.infer<typeof createPropertySchema>
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>
export type CreatePropertyFactInput = z.infer<typeof createPropertyFactSchema>
export type UpdatePropertyFactInput = z.infer<typeof updatePropertyFactSchema>
export type PropertyStage = (typeof propertyStages)[number]
export type PropertyFactStatus = (typeof propertyFactStatuses)[number]

export type PropertyProject = CreatePropertyInput & {
  id: string
  organizationId: string
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
}

export type PropertyFact = Omit<CreatePropertyFactInput, 'sourceIds'> & {
  id: string
  propertyProjectId: string
  version: number
  createdByType: 'user' | 'ai' | 'integration'
  createdById: string
  confirmedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

- [ ] **Step 4: Uruchom test domeny**

Run:

```bash
npm test -- src/features/properties/domain.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/properties/domain.ts src/features/properties/domain.test.ts
git commit -m "feat: define property truth domain rules"
```

## Task 3: Schemat PostgreSQL i migracja

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/lib/db/client.ts`
- Create: `src/features/properties/schema.ts`
- Create: `drizzle/*_property_truth_foundation.sql`

- [ ] **Step 1: Utwórz konfigurację migracji**

Create `drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for Drizzle commands')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/features/properties/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
})
```

- [ ] **Step 2: Utwórz klienta serwerowego**

Create `src/lib/db/client.ts`:

```ts
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
```

- [ ] **Step 3: Utwórz schemat tabel**

Create `src/features/properties/schema.ts`:

```ts
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
export const transactionTypeEnum = pgEnum('transaction_type', transactionTypes)
export const propertyStageEnum = pgEnum('property_stage', propertyStages)
export const addressModeEnum = pgEnum('address_mode', addressModes)
export const factStatusEnum = pgEnum('property_fact_status', propertyFactStatuses)
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: uniqueIndex('organizations_owner_user_idx').on(table.ownerUserId),
  }),
)

export const organizationMemberships = pgTable(
  'organization_memberships',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    role: organizationRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.organizationId, table.userId] }),
    userIdx: index('organization_memberships_user_idx').on(table.userId),
  }),
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => ({
    organizationUpdatedIdx: index('property_projects_org_updated_idx').on(
      table.organizationId,
      table.updatedAt,
    ),
  }),
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
    value: jsonb('value').notNull(),
    unit: text('unit'),
    status: factStatusEnum('status').notNull(),
    visibility: factVisibilityEnum('visibility').notNull().default('internal'),
    createdByType: actorTypeEnum('created_by_type').notNull(),
    createdById: text('created_by_id').notNull(),
    confirmedByUserId: text('confirmed_by_user_id'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectKeyIdx: uniqueIndex('property_facts_project_key_idx').on(
      table.propertyProjectId,
      table.key,
    ),
    projectStatusIdx: index('property_facts_project_status_idx').on(
      table.propertyProjectId,
      table.status,
    ),
  }),
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    propertyCreatedIdx: index('property_audit_property_created_idx').on(
      table.propertyProjectId,
      table.createdAt,
    ),
  }),
)
```

- [ ] **Step 4: Wygeneruj migrację**

Run:

```bash
npm run db:generate -- --name property_truth_foundation
```

Expected: katalog `drizzle/` zawiera migrację tworzącą enumy, pięć tabel,
klucze obce i indeksy opisane w schemacie.

- [ ] **Step 5: Zastosuj migrację na lokalnej lub testowej bazie**

Run:

```bash
npm run db:migrate
```

Expected: migracja kończy się kodem 0. Nie uruchamiaj tego kroku przeciwko bazie
produkcyjnej bez osobnej weryfikacji środowiska.

- [ ] **Step 6: Commit**

```bash
git add drizzle.config.ts drizzle src/lib/db/client.ts src/features/properties/schema.ts
git commit -m "feat: add property truth postgres schema"
```

## Task 4: Kontrakt repozytorium i testowa implementacja pamięciowa

**Files:**
- Create: `src/features/properties/repository.ts`
- Create: `src/features/properties/memory-repository.ts`

- [ ] **Step 1: Zdefiniuj kontrakt danych**

Create `src/features/properties/repository.ts`:

```ts
import type {
  CreatePropertyFactInput,
  CreatePropertyInput,
  PropertyFact,
  PropertyProject,
  UpdatePropertyFactInput,
  UpdatePropertyInput,
} from './domain'

export type AuditRecord = {
  id: string
  organizationId: string
  propertyProjectId: string | null
  actorType: 'user' | 'ai' | 'integration'
  actorId: string
  action: string
  entityType: string
  entityId: string
  before: unknown
  after: unknown
  createdAt: Date
}

export interface PropertyRepository {
  getOrCreatePersonalOrganization(userId: string): Promise<string>
  listProjects(userId: string): Promise<PropertyProject[]>
  getProject(userId: string, projectId: string): Promise<PropertyProject | null>
  createProject(
    userId: string,
    organizationId: string,
    input: CreatePropertyInput,
  ): Promise<PropertyProject>
  updateProject(
    userId: string,
    projectId: string,
    input: UpdatePropertyInput,
  ): Promise<PropertyProject | null>
  listFacts(userId: string, projectId: string): Promise<PropertyFact[]>
  getFact(userId: string, projectId: string, factId: string): Promise<PropertyFact | null>
  createFact(
    userId: string,
    projectId: string,
    input: CreatePropertyFactInput,
  ): Promise<PropertyFact | null>
  updateFact(
    userId: string,
    projectId: string,
    factId: string,
    input: UpdatePropertyFactInput,
  ): Promise<PropertyFact | null>
  appendAudit(record: Omit<AuditRecord, 'id' | 'createdAt'>): Promise<void>
  exportForUser(userId: string): Promise<{
    projects: PropertyProject[]
    facts: PropertyFact[]
    audit: AuditRecord[]
  }>
  deleteForUser(userId: string): Promise<void>
}
```

- [ ] **Step 2: Utwórz implementację do testów**

Create `src/features/properties/memory-repository.ts`:

```ts
import crypto from 'node:crypto'
import type {
  CreatePropertyFactInput,
  CreatePropertyInput,
  PropertyFact,
  PropertyProject,
  UpdatePropertyFactInput,
  UpdatePropertyInput,
} from './domain'
import type { AuditRecord, PropertyRepository } from './repository'

export class MemoryPropertyRepository implements PropertyRepository {
  private organizations = new Map<string, string>()
  private projects: PropertyProject[] = []
  private facts: PropertyFact[] = []
  private audit: AuditRecord[] = []

  async getOrCreatePersonalOrganization(userId: string) {
    const existing = this.organizations.get(userId)
    if (existing) return existing
    const id = crypto.randomUUID()
    this.organizations.set(userId, id)
    return id
  }

  async listProjects(userId: string) {
    const organizationId = this.organizations.get(userId)
    if (!organizationId) return []
    return this.projects.filter((project) => project.organizationId === organizationId)
  }

  async getProject(userId: string, projectId: string) {
    const organizationId = this.organizations.get(userId)
    return (
      this.projects.find(
        (project) => project.id === projectId && project.organizationId === organizationId,
      ) ?? null
    )
  }

  async createProject(
    userId: string,
    organizationId: string,
    input: CreatePropertyInput,
  ) {
    const now = new Date()
    const project: PropertyProject = {
      ...input,
      id: crypto.randomUUID(),
      organizationId,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    }
    this.projects.push(project)
    return project
  }

  async updateProject(userId: string, projectId: string, input: UpdatePropertyInput) {
    const project = await this.getProject(userId, projectId)
    if (!project) return null
    Object.assign(project, input, { updatedAt: new Date() })
    return project
  }

  async listFacts(userId: string, projectId: string) {
    if (!(await this.getProject(userId, projectId))) return []
    return this.facts.filter((fact) => fact.propertyProjectId === projectId)
  }

  async getFact(userId: string, projectId: string, factId: string) {
    if (!(await this.getProject(userId, projectId))) return null
    return (
      this.facts.find(
        (fact) => fact.propertyProjectId === projectId && fact.id === factId,
      ) ?? null
    )
  }

  async createFact(
    userId: string,
    projectId: string,
    input: CreatePropertyFactInput,
  ) {
    if (!(await this.getProject(userId, projectId))) return null
    const now = new Date()
    const fact: PropertyFact = {
      ...input,
      id: crypto.randomUUID(),
      propertyProjectId: projectId,
      createdByType: 'user',
      createdById: userId,
      confirmedAt: input.status === 'confirmed' ? now : null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }
    this.facts.push(fact)
    return fact
  }

  async updateFact(
    userId: string,
    projectId: string,
    factId: string,
    input: UpdatePropertyFactInput,
  ) {
    const fact = await this.getFact(userId, projectId, factId)
    if (!fact) return null
    const { actorType: _actorType, ...changes } = input
    Object.assign(fact, changes, {
      version: fact.version + 1,
      confirmedAt: changes.status === 'confirmed' ? new Date() : fact.confirmedAt,
      updatedAt: new Date(),
    })
    return fact
  }

  async appendAudit(record: Omit<AuditRecord, 'id' | 'createdAt'>) {
    this.audit.push({
      ...record,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    })
  }

  async exportForUser(userId: string) {
    const projects = await this.listProjects(userId)
    const projectIds = new Set(projects.map((project) => project.id))
    return {
      projects,
      facts: this.facts.filter((fact) => projectIds.has(fact.propertyProjectId)),
      audit: this.audit.filter((event) => event.actorId === userId),
    }
  }

  async deleteForUser(userId: string) {
    const organizationId = this.organizations.get(userId)
    if (!organizationId) return
    const projectIds = new Set(
      this.projects
        .filter((project) => project.organizationId === organizationId)
        .map((project) => project.id),
    )
    this.facts = this.facts.filter((fact) => !projectIds.has(fact.propertyProjectId))
    this.audit = this.audit.filter((event) => event.organizationId !== organizationId)
    this.projects = this.projects.filter(
      (project) => project.organizationId !== organizationId,
    )
    this.organizations.delete(userId)
  }
}
```

- [ ] **Step 3: Sprawdź typy**

Run:

```bash
npx tsc --noEmit
```

Expected: kod 0.

- [ ] **Step 4: Commit**

```bash
git add src/features/properties/repository.ts src/features/properties/memory-repository.ts
git commit -m "feat: add property repository contract"
```

## Task 5: Serwis domenowy, audyt i izolacja użytkowników

**Files:**
- Create: `src/features/properties/service.test.ts`
- Create: `src/features/properties/service.ts`

- [ ] **Step 1: Napisz testy zachowania**

Create `src/features/properties/service.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryPropertyRepository } from './memory-repository'
import { PropertyService } from './service'

describe('PropertyService', () => {
  let repository: MemoryPropertyRepository
  let service: PropertyService

  beforeEach(() => {
    repository = new MemoryPropertyRepository()
    service = new PropertyService(repository)
  })

  it('isolates projects between users', async () => {
    const project = await service.createProject('user-a', {
      title: 'Działka Strzeszyn',
      propertyType: 'plot',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'approximate',
      plotIdentifier: '306401_1.0024.18/4',
    })

    await expect(service.getProject('user-b', project.id)).rejects.toThrow(
      'PROPERTY_NOT_FOUND',
    )
  })

  it('creates an audit event for a new fact', async () => {
    const project = await service.createProject('user-a', {
      title: 'Mieszkanie Jeżyce',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })

    await service.createFact('user-a', project.id, {
      key: 'usableArea',
      label: 'Powierzchnia użytkowa',
      category: 'areas',
      valueType: 'number',
      value: 52.4,
      unit: 'm2',
      status: 'confirmed',
      visibility: 'public',
      confirmedByUserId: 'user-a',
      sourceIds: [],
    })

    const exported = await repository.exportForUser('user-a')
    expect(exported.audit.map((event) => event.action)).toContain('fact.created')
  })

  it('increments the version when a fact changes', async () => {
    const project = await service.createProject('user-a', {
      title: 'Dom Podolany',
      propertyType: 'house',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })
    const fact = await service.createFact('user-a', project.id, {
      key: 'rooms',
      label: 'Liczba pokoi',
      category: 'layout',
      valueType: 'number',
      value: 4,
      status: 'declared',
      visibility: 'public',
      sourceIds: ['owner-declaration'],
    })

    const updated = await service.updateFact('user-a', project.id, fact.id, {
      value: 5,
      status: 'declared',
      actorType: 'user',
    })

    expect(updated.version).toBe(2)
    expect(updated.value).toBe(5)
  })
})
```

- [ ] **Step 2: Uruchom test i potwierdź błąd**

Run:

```bash
npm test -- src/features/properties/service.test.ts
```

Expected: FAIL, ponieważ moduł `./service` nie istnieje.

- [ ] **Step 3: Zaimplementuj serwis**

Create `src/features/properties/service.ts`:

```ts
import {
  createPropertyFactSchema,
  createPropertySchema,
  updatePropertyFactSchema,
  updatePropertySchema,
} from './domain'
import type { PropertyRepository } from './repository'

export class PropertyService {
  constructor(private readonly repository: PropertyRepository) {}

  listProjects(userId: string) {
    return this.repository.listProjects(userId)
  }

  async getProject(userId: string, projectId: string) {
    const project = await this.repository.getProject(userId, projectId)
    if (!project) throw new Error('PROPERTY_NOT_FOUND')
    return project
  }

  async createProject(userId: string, rawInput: unknown) {
    const input = createPropertySchema.parse(rawInput)
    const organizationId = await this.repository.getOrCreatePersonalOrganization(userId)
    const project = await this.repository.createProject(userId, organizationId, input)
    await this.repository.appendAudit({
      organizationId,
      propertyProjectId: project.id,
      actorType: 'user',
      actorId: userId,
      action: 'property.created',
      entityType: 'property',
      entityId: project.id,
      before: null,
      after: project,
    })
    return project
  }

  async updateProject(userId: string, projectId: string, rawInput: unknown) {
    const before = await this.getProject(userId, projectId)
    const input = updatePropertySchema.parse(rawInput)
    const updated = await this.repository.updateProject(userId, projectId, input)
    if (!updated) throw new Error('PROPERTY_NOT_FOUND')
    await this.repository.appendAudit({
      organizationId: before.organizationId,
      propertyProjectId: projectId,
      actorType: 'user',
      actorId: userId,
      action: 'property.updated',
      entityType: 'property',
      entityId: projectId,
      before,
      after: updated,
    })
    return updated
  }

  async listFacts(userId: string, projectId: string) {
    await this.getProject(userId, projectId)
    return this.repository.listFacts(userId, projectId)
  }

  async createFact(userId: string, projectId: string, rawInput: unknown) {
    const project = await this.getProject(userId, projectId)
    const input = createPropertyFactSchema.parse(rawInput)
    const fact = await this.repository.createFact(userId, projectId, input)
    if (!fact) throw new Error('PROPERTY_NOT_FOUND')
    await this.repository.appendAudit({
      organizationId: project.organizationId,
      propertyProjectId: projectId,
      actorType: 'user',
      actorId: userId,
      action: 'fact.created',
      entityType: 'property_fact',
      entityId: fact.id,
      before: null,
      after: fact,
    })
    return fact
  }

  async updateFact(
    userId: string,
    projectId: string,
    factId: string,
    rawInput: unknown,
  ) {
    const project = await this.getProject(userId, projectId)
    const before = await this.repository.getFact(userId, projectId, factId)
    if (!before) throw new Error('FACT_NOT_FOUND')
    const input = updatePropertyFactSchema.parse(rawInput)
    const updated = await this.repository.updateFact(userId, projectId, factId, input)
    if (!updated) throw new Error('FACT_NOT_FOUND')
    await this.repository.appendAudit({
      organizationId: project.organizationId,
      propertyProjectId: projectId,
      actorType: input.actorType,
      actorId: userId,
      action: 'fact.updated',
      entityType: 'property_fact',
      entityId: factId,
      before,
      after: updated,
    })
    return updated
  }
}
```

- [ ] **Step 4: Uruchom testy**

Run:

```bash
npm test -- src/features/properties/domain.test.ts src/features/properties/service.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/properties/service.ts src/features/properties/service.test.ts
git commit -m "feat: enforce property truth service rules"
```

## Task 6: Repozytorium PostgreSQL

**Files:**
- Create: `src/features/properties/postgres-repository.ts`

- [ ] **Step 1: Zaimplementuj wszystkie metody kontraktu**

Create `src/features/properties/postgres-repository.ts` jako implementację
`PropertyRepository` opartą na `db` i tabelach z `schema.ts`.

Wymagane zachowania każdej metody:

```ts
// Każdy odczyt projektu musi zawierać ten warunek dostępu:
innerJoin(
  organizationMemberships,
  eq(propertyProjects.organizationId, organizationMemberships.organizationId),
)
where(
  and(
    eq(propertyProjects.id, projectId),
    eq(organizationMemberships.userId, userId),
  ),
)
```

Tworzenie osobistej organizacji wykonaj w transakcji:

```ts
const existing = await tx
  .select({ id: organizations.id })
  .from(organizations)
  .where(eq(organizations.ownerUserId, userId))
  .limit(1)

if (existing[0]) return existing[0].id

const [organization] = await tx
  .insert(organizations)
  .values({ name: 'Moje Studio', ownerUserId: userId })
  .onConflictDoNothing({ target: organizations.ownerUserId })
  .returning({ id: organizations.id })

const organizationId =
  organization?.id ??
  (
    await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.ownerUserId, userId))
      .limit(1)
  )[0].id

await tx
  .insert(organizationMemberships)
  .values({ organizationId, userId, role: 'owner' })
  .onConflictDoNothing()

return organizationId
```

Aktualizacja faktu musi atomowo zwiększać `version`:

```ts
version: sql`${propertyFacts.version} + 1`,
updatedAt: new Date(),
```

`deleteForUser` ma usuwać wyłącznie organizację, której `ownerUserId` odpowiada
użytkownikowi. Usunięcie kaskadowe usuwa projekty, fakty, audyt i członkostwa.

- [ ] **Step 2: Eksportuj pojedynczą instancję**

Na końcu pliku dodaj:

```ts
export const postgresPropertyRepository = new PostgresPropertyRepository()
```

- [ ] **Step 3: Sprawdź kontrakt TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: kod 0 i brak niezaimplementowanych metod interfejsu.

- [ ] **Step 4: Commit**

```bash
git add src/features/properties/postgres-repository.ts
git commit -m "feat: persist property truth data in postgres"
```

## Task 7: API portfolio i paszportu

**Files:**
- Create: `src/app/api/properties/route.ts`
- Create: `src/app/api/properties/[propertyId]/route.ts`
- Create: `src/app/api/properties/[propertyId]/facts/route.ts`
- Create: `src/app/api/properties/[propertyId]/facts/[factId]/route.ts`

- [ ] **Step 1: Dodaj wspólny sposób mapowania błędów w każdej trasie**

Każda trasa używa:

```ts
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'validation_error', issues: error.issues },
      { status: 400 },
    )
  }
  if (error instanceof Error && error.message.endsWith('_NOT_FOUND')) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  console.error('[property-api]', error instanceof Error ? error.message : 'unknown')
  return NextResponse.json({ error: 'internal_error' }, { status: 500 })
}
```

Nie loguj body requestu, wartości faktów ani identyfikatorów źródeł.

- [ ] **Step 2: Zaimplementuj listę i tworzenie**

`src/app/api/properties/route.ts`:

```ts
export const runtime = 'nodejs'

const service = new PropertyService(postgresPropertyRepository)

export async function GET() {
  const userId = await getServerUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ projects: await service.listProjects(userId) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  const userId = await getServerUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const project = await service.createProject(userId, await request.json())
    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
```

Dodaj wymagane importy z `@/lib/session`,
`@/features/properties/service` i
`@/features/properties/postgres-repository`.

- [ ] **Step 3: Zaimplementuj odczyt i zmianę projektu**

`src/app/api/properties/[propertyId]/route.ts` udostępnia:

- `GET` wywołujący `service.getProject(userId, params.propertyId)`,
- `PATCH` wywołujący
  `service.updateProject(userId, params.propertyId, await request.json())`.

Brak sesji zwraca 401, brak dostępu i brak projektu zwracają ten sam kod 404.

- [ ] **Step 4: Zaimplementuj listę i tworzenie faktów**

`src/app/api/properties/[propertyId]/facts/route.ts` udostępnia:

- `GET` wywołujący `service.listFacts`,
- `POST` wywołujący `service.createFact` i zwracający 201.

- [ ] **Step 5: Zaimplementuj aktualizację faktu**

`src/app/api/properties/[propertyId]/facts/[factId]/route.ts` udostępnia
`PATCH` wywołujący:

```ts
service.updateFact(
  userId,
  params.propertyId,
  params.factId,
  await request.json(),
)
```

- [ ] **Step 6: Sprawdź lint i typy**

Run:

```bash
npm run lint
npx tsc --noEmit
```

Expected: obie komendy kończą się kodem 0.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/properties
git commit -m "feat: expose authenticated property truth api"
```

## Task 8: Portfolio nieruchomości

**Files:**
- Create: `src/app/(dashboard)/nieruchomosci/page.tsx`
- Create: `src/app/(dashboard)/nieruchomosci/NewPropertyForm.tsx`
- Create: `src/app/(dashboard)/nieruchomosci/PropertyCard.tsx`

- [ ] **Step 1: Przygotuj trzy kierunki UI i uzyskaj wybór Darka**

Pokaż dla każdego kierunku paletę, typografię, layout oraz mood. Nie koduj
ekranów przed wyborem. Istniejąca „Czarna porcelana” może być jednym z trzech
kierunków.

- [ ] **Step 2: Zbuduj server component portfolio**

`page.tsx`:

```tsx
import { requireServerUserId } from '@/lib/session'
import { postgresPropertyRepository } from '@/features/properties/postgres-repository'
import { PropertyService } from '@/features/properties/service'
import NewPropertyForm from './NewPropertyForm'
import PropertyCard from './PropertyCard'

export const dynamic = 'force-dynamic'

export default async function PropertiesPage() {
  const userId = await requireServerUserId()
  const projects = await new PropertyService(
    postgresPropertyRepository,
  ).listProjects(userId)

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="eyebrow">Property Intelligence Studio</p>
        <h1 className="display-title text-foreground">Nieruchomości</h1>
        <p className="mt-3 max-w-2xl text-foreground/55">
          Jedna teczka faktów, źródeł i materiałów dla każdej oferty.
        </p>
      </header>
      <NewPropertyForm />
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <PropertyCard key={project.id} project={project} />
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Zbuduj formularz tworzenia**

`NewPropertyForm.tsx` ma być client componentem i:

- zbierać pola minimalne ze specyfikacji,
- wysyłać JSON do `POST /api/properties`,
- pokazywać błędy 400 bez utraty wpisanych danych,
- po 201 wywołać `router.push('/nieruchomosci/' + project.id)`,
- blokować przycisk na czas pojedynczego requestu,
- nie wysyłać pustego adresu dla trybu `hidden`.

- [ ] **Step 4: Zbuduj kartę projektu**

`PropertyCard.tsx` ma pokazywać:

- tytuł,
- typ i rodzaj procesu,
- miasto oraz dzielnicę,
- etap,
- datę ostatniej zmiany,
- link do `/nieruchomosci/[id]`.

Nie pokazuj dokładnego adresu na karcie portfolio.

- [ ] **Step 5: Zweryfikuj responsywność**

Run:

```bash
npm run dev
```

Expected:

- 375 px: jedna kolumna, formularz bez poziomego scrolla,
- 768 px: dwie kolumny kart,
- 1440 px: maksymalnie trzy kolumny,
- klawiatura pozwala przejść przez wszystkie pola i akcje.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/nieruchomosci"
git commit -m "feat: add property studio portfolio"
```

## Task 9: Workspace i paszport faktów

**Files:**
- Create: `src/app/(dashboard)/nieruchomosci/[propertyId]/page.tsx`
- Create: `src/app/(dashboard)/nieruchomosci/[propertyId]/AddFactForm.tsx`
- Create: `src/app/(dashboard)/nieruchomosci/[propertyId]/FactsBoard.tsx`

- [ ] **Step 1: Zbuduj server component workspace**

`page.tsx` pobiera projekt oraz fakty równolegle po sprawdzeniu sesji:

```tsx
const userId = await requireServerUserId()
const service = new PropertyService(postgresPropertyRepository)
const [project, facts] = await Promise.all([
  service.getProject(userId, params.propertyId),
  service.listFacts(userId, params.propertyId),
])
```

Przy `PROPERTY_NOT_FOUND` wywołaj `notFound()` bez ujawniania, czy projekt
istnieje u innego użytkownika.

- [ ] **Step 2: Zbuduj tablicę faktów**

`FactsBoard.tsx`:

- grupuje fakty po `category`,
- pokazuje etykietę, wartość, jednostkę, status i widoczność,
- używa stałych polskich etykiet statusów,
- wyróżnia `conflicting` i `missing`,
- renderuje obiekt JSON w `<pre>` po bezpiecznym `JSON.stringify`,
- nie używa `dangerouslySetInnerHTML`.

- [ ] **Step 3: Zbuduj formularz faktu**

`AddFactForm.tsx` wysyła do endpointu faktów:

```json
{
  "key": "usableArea",
  "label": "Powierzchnia użytkowa",
  "category": "areas",
  "valueType": "number",
  "value": 52.4,
  "unit": "m2",
  "status": "declared",
  "visibility": "internal",
  "sourceIds": []
}
```

Dla statusu `confirmed` formularz ustawia
`confirmedByUserId: "current-session-user"` wyłącznie jako sygnał UI. Serwer
ignoruje przesłany identyfikator i zastępuje go `userId` z sesji przed
walidacją. Dodaj tę normalizację w `PropertyService.createFact`.

- [ ] **Step 4: Dodaj sekcję braków i konfliktów**

Na górze workspace pokaż:

```ts
const unresolved = facts.filter(
  (fact) => fact.status === 'missing' || fact.status === 'conflicting',
)
```

Sekcja ma wyświetlać liczbę i listę bez obliczania oceny jakości
nieruchomości.

- [ ] **Step 5: Uruchom pełną weryfikację**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: wszystkie testy PASS, lint bez błędów, build kończy się kodem 0.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/nieruchomosci/[propertyId]" src/features/properties/service.ts
git commit -m "feat: add source-aware property passport"
```

## Task 10: Nawigacja i nowy punkt wejścia

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `src/app/(dashboard)/start/page.tsx`

- [ ] **Step 1: Dodaj Studio do nawigacji**

W `navItems` dodaj po `Start`:

```ts
{ name: 'Nieruchomości', href: '/nieruchomosci' },
```

Nie usuwaj istniejących elementów nawigacji w tej fazie.

- [ ] **Step 2: Dodaj główne CTA na Start**

Na `/start` dodaj przed sekcjami szkoleniowymi kartę:

```tsx
<Link
  href="/nieruchomosci"
  className="block rounded-[2rem] border border-border bg-[color:var(--card)] p-6"
>
  <p className="eyebrow">Property Intelligence Studio</p>
  <h2 className="mt-3 font-display text-2xl text-foreground">
    Otwórz teczkę nieruchomości
  </h2>
  <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/55">
    Zbierz fakty, oznacz braki i przygotuj ofertę na jednym źródle prawdy.
  </p>
</Link>
```

- [ ] **Step 3: Smoke test nawigacji**

Sprawdź ręcznie:

- `/start` prowadzi do portfolio,
- aktywny stan nawigacji działa na liście i workspace,
- mobilna nawigacja przewija się bez zasłaniania pierwszego elementu,
- stare trasy nadal działają.

- [ ] **Step 4: Commit**

```bash
git add src/components/Navbar.tsx "src/app/(dashboard)/start/page.tsx"
git commit -m "feat: make property studio the primary workflow"
```

## Task 11: Eksport, usunięcie danych i dokumentacja bezpieczeństwa

**Files:**
- Modify: `src/app/api/account/export/route.ts`
- Modify: `src/app/api/account/delete/route.ts`
- Modify: `docs/SECURITY.md`

- [ ] **Step 1: Rozszerz eksport konta**

Zaimportuj `postgresPropertyRepository`, pobierz:

```ts
const propertyStudio = await postgresPropertyRepository.exportForUser(userId)
```

Dodaj `propertyStudio` do zwracanego obiektu `data`. Eksport nie zawiera
podpisanych adresów plików ani sekretów dostawców.

- [ ] **Step 2: Rozszerz usunięcie konta**

Przed usuwaniem kluczy KV wywołaj:

```ts
await postgresPropertyRepository.deleteForUser(userId)
```

Jeżeli usunięcie PostgreSQL się nie powiedzie, endpoint zwraca 500 i nie czyści
cookie. Użytkownik nie może otrzymać odpowiedzi o pełnym usunięciu po częściowej
operacji.

- [ ] **Step 3: Zaktualizuj dokument bezpieczeństwa**

W `docs/SECURITY.md` opisz:

- PostgreSQL jako źródło danych Property Intelligence Studio,
- zakres nowych danych,
- izolację przez członkostwo organizacji,
- audyt zmian,
- rozszerzony eksport i usunięcie,
- zakaz logowania wartości faktów.

Nie zapisuj w dokumentacji adresu produkcyjnej bazy ani wartości sekretów.

- [ ] **Step 4: Weryfikacja RODO**

Utwórz projekt i fakt na koncie testowym, pobierz eksport, a następnie usuń
konto testowe. Sprawdź zapytaniem administracyjnym do bazy, że organizacja,
projekt, fakt i wpisy audytu nie istnieją.

Expected: brak rekordów dla usuniętego `userId`; dane innego użytkownika
pozostają bez zmian.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/account/export/route.ts src/app/api/account/delete/route.ts docs/SECURITY.md
git commit -m "feat: cover property studio data in GDPR workflows"
```

## Task 12: Końcowa weryfikacja fundamentu

**Files:**
- Verify: all files changed by Tasks 1–11

- [ ] **Step 1: Uruchom testy**

Run:

```bash
npm test
```

Expected: wszystkie testy PASS.

- [ ] **Step 2: Uruchom statyczną kontrolę**

Run:

```bash
npm run lint
npx tsc --noEmit
```

Expected: obie komendy kończą się kodem 0.

- [ ] **Step 3: Zbuduj wersję produkcyjną**

Run:

```bash
npm run build
```

Expected: Next.js kończy build kodem 0 i wymienia nowe trasy
`/nieruchomosci`, `/nieruchomosci/[propertyId]` oraz API.

- [ ] **Step 4: Wykonaj test izolacji**

1. Utwórz nieruchomość jako użytkownik A.
2. Skopiuj identyfikator projektu.
3. Zaloguj się jako użytkownik B.
4. Otwórz `/nieruchomosci/<id-użytkownika-A>`.
5. Wywołaj również `GET /api/properties/<id-użytkownika-A>`.

Expected: UI pokazuje 404, API zwraca 404, log nie ujawnia tytułu ani danych
projektu.

- [ ] **Step 5: Wykonaj test reguły potwierdzenia**

Spróbuj przez API utworzyć fakt `confirmed` bez źródła i bez potwierdzenia
sesyjnego.

Expected: 400 `validation_error`.

- [ ] **Step 6: Sprawdź status repo**

Run:

```bash
git status --short
git log --oneline -12
```

Expected: brak niezatwierdzonych plików należących do planu i osobne,
czytelne commity dla kolejnych pionowych kroków.

