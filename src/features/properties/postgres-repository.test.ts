import { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { propertyErrorResponse } from './http'
import { PostgresPropertyRepository } from './postgres-repository'
import { propertyFacts } from './schema'
import { PropertyService } from './service'

describe('PostgresPropertyRepository', () => {
  let client: PGlite
  let repository: PostgresPropertyRepository
  let service: PropertyService

  beforeEach(async () => {
    client = new PGlite()
    const database = drizzle(client)
    await migrate(database, { migrationsFolder: './drizzle' })
    repository = new PostgresPropertyRepository(database)
    service = new PropertyService(repository)
  })

  afterEach(async () => {
    await client.close()
  })

  it('persists projects and isolates them between users', async () => {
    const project = await createApartment(service, 'user-a')

    await expect(service.getProject('user-b', project.id)).rejects.toThrow(
      'PROPERTY_NOT_FOUND',
    )

    const visibleToOwner = await service.listProjects('user-a')
    const visibleToOtherUser = await service.listProjects('user-b')

    expect(visibleToOwner).toHaveLength(1)
    expect(visibleToOtherUser).toHaveLength(0)
  })

  it('persists fact versions and their audit history', async () => {
    const project = await createApartment(service, 'user-a')
    const fact = await service.createFact('user-a', project.id, {
      key: 'price.asking',
      label: 'Cena ofertowa',
      category: 'Cena',
      valueType: 'money',
      value: 700000,
      unit: 'PLN',
      status: 'declared',
      visibility: 'public',
      sourceIds: ['owner-declaration'],
    })

    const updated = await service.updateFact(
      'user-a',
      project.id,
      fact.id,
      {
        value: 680000,
        actorType: 'user',
      },
    )
    const exported = await repository.exportForUser('user-a')

    expect(updated.version).toBe(2)
    expect(updated.value).toBe(680000)
    expect(exported.facts).toHaveLength(1)
    expect(exported.audit.map((event) => event.action)).toEqual([
      'property.created',
      'fact.created',
      'fact.updated',
    ])
  })

  it('rolls back a created fact when its audit insert fails', async () => {
    const project = await createApartment(service, 'user-a')
    await rejectFactMutationAudits(client)
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await Promise.allSettled([
      service.createFact('user-a', project.id, {
        key: 'area.usable',
        label: 'Powierzchnia użytkowa',
        category: 'Powierzchnia',
        valueType: 'number',
        value: 52,
        unit: 'm²',
        status: 'declared',
        visibility: 'client',
        sourceIds: [],
      }),
    ])

    expect(result[0].status).toBe('rejected')
    const response = propertyErrorResponse(
      result[0].status === 'rejected' ? result[0].reason : null,
    )
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'internal_error',
    })
    await expect(repository.listFacts('user-a', project.id)).resolves.toEqual(
      [],
    )
    await expect(repository.listAudit('user-a', project.id)).resolves.toEqual([
      expect.objectContaining({ action: 'property.created' }),
    ])
    errorLog.mockRestore()
  })

  it('rolls back a legacy update and canonicalization when its audit insert fails', async () => {
    const project = await createApartment(service, 'user-a')
    const database = drizzle(client)
    const [legacyBefore] = await database
      .insert(propertyFacts)
      .values({
        propertyProjectId: project.id,
        key: 'powierzchniaUzytkowa',
        semanticKey: null,
        label: 'Powierzchnia użytkowa',
        category: 'areas',
        valueType: 'number',
        value: 52,
        unit: 'm2',
        status: 'declared',
        visibility: 'client',
        sourceIds: [],
        createdByType: 'user',
        createdById: 'user-a',
      })
      .returning()
    await rejectFactMutationAudits(client)

    await expect(
      service.updateFact('user-a', project.id, legacyBefore.id, {
        value: 53,
        status: 'confirmed',
      }),
    ).rejects.toThrow()

    const [legacyAfter] = await database
      .select()
      .from(propertyFacts)
      .where(eq(propertyFacts.id, legacyBefore.id))
      .limit(1)
    expect(legacyAfter).toEqual(legacyBefore)
    expect(legacyAfter).toMatchObject({
      key: 'powierzchniaUzytkowa',
      semanticKey: null,
      value: 52,
      status: 'declared',
      version: 1,
    })
    await expect(repository.listAudit('user-a', project.id)).resolves.toEqual([
      expect.objectContaining({ action: 'property.created' }),
    ])
  })

  it.each([
    {
      field: 'value',
      patch: { value: 53 },
      expectedValue: 53,
      expectedStatus: 'declared',
    },
    {
      field: 'status',
      patch: { status: 'confirmed' as const },
      expectedValue: 52,
      expectedStatus: 'confirmed',
    },
  ])(
    'canonicalizes a legacy fact on its first $field-only update',
    async ({ patch, expectedValue, expectedStatus }) => {
      const project = await createApartment(service, 'user-a')
      const legacy = await repository.createFact('user-a', project.id, {
        key: 'powierzchniaUzytkowa',
        label: 'Powierzchnia użytkowa',
        category: 'areas',
        valueType: 'number',
        value: 52,
        unit: 'm2',
        status: 'declared',
        visibility: 'client',
        sourceIds: ['owner-declaration'],
      })
      if (!legacy) throw new Error('FACT_SETUP_FAILED')

      const updated = await service.updateFact(
        'user-a',
        project.id,
        legacy.id,
        patch,
      )

      expect(updated).toMatchObject({
        id: legacy.id,
        key: 'area.usable',
        label: 'Powierzchnia użytkowa',
        category: 'Powierzchnia',
        valueType: 'number',
        value: expectedValue,
        unit: 'm²',
        status: expectedStatus,
        version: 2,
      })
      await expect(
        repository.listFacts('user-a', project.id),
      ).resolves.toEqual([updated])
      expect(
        await repository.listAudit('user-a', project.id),
      ).toContainEqual(
        expect.objectContaining({
          action: 'fact.updated',
          entityId: legacy.id,
          before: expect.objectContaining({
            id: legacy.id,
            key: 'powierzchniaUzytkowa',
            value: 52,
          }),
          after: expect.objectContaining({
            id: legacy.id,
            key: 'area.usable',
            value: expectedValue,
          }),
        }),
      )
    },
  )

  it('preserves pre-existing canonical and legacy facts when canonicalization conflicts', async () => {
    const project = await createApartment(service, 'user-a')
    const database = drizzle(client)
    await database.insert(propertyFacts).values([
      {
        propertyProjectId: project.id,
        key: 'powierzchniaUzytkowa',
        label: 'Powierzchnia użytkowa',
        category: 'areas',
        valueType: 'number',
        value: 52,
        unit: 'm2',
        status: 'declared',
        visibility: 'client',
        sourceIds: [],
        createdByType: 'user',
        createdById: 'user-a',
      },
      {
        propertyProjectId: project.id,
        key: 'area.usable',
        label: 'Powierzchnia użytkowa',
        category: 'Powierzchnia',
        valueType: 'number',
        value: 53,
        unit: 'm²',
        status: 'confirmed',
        visibility: 'client',
        sourceIds: ['owner-declaration'],
        createdByType: 'user',
        createdById: 'user-a',
      },
    ])
    const before = await repository.listFacts('user-a', project.id)
    const legacy = before.find(
      (fact) => fact.key === 'powierzchniaUzytkowa',
    )
    if (!legacy) throw new Error('FACT_SETUP_FAILED')

    await expect(
      service.updateFact('user-a', project.id, legacy.id, {
        status: 'confirmed',
      }),
    ).rejects.toMatchObject({
      code: 'PROPERTY_FACT_SEMANTIC_CONFLICT',
      policy: 'preserve_existing_fact',
    })
    await expect(repository.listFacts('user-a', project.id)).resolves.toEqual(
      before,
    )
  })

  it('returns the same personal organization for concurrent requests', async () => {
    const organizationIds = await Promise.all([
      repository.getOrCreatePersonalOrganization('user-a'),
      repository.getOrCreatePersonalOrganization('user-a'),
    ])

    expect(new Set(organizationIds).size).toBe(1)
  })

  it('deletes one user data without changing another user projects', async () => {
    await createApartment(service, 'user-a')
    await createApartment(service, 'user-b')

    await repository.deleteForUser('user-a')

    expect(await service.listProjects('user-a')).toHaveLength(0)
    expect(await service.listProjects('user-b')).toHaveLength(1)
  })

  it('returns scoped property audit history newest first', async () => {
    const project = await createApartment(service, 'user-a')
    await service.createFact('user-a', project.id, {
      key: 'area.usable',
      label: 'Powierzchnia użytkowa',
      category: 'Powierzchnia',
      valueType: 'number',
      value: 52,
      unit: 'm²',
      status: 'declared',
      visibility: 'client',
      sourceIds: [],
    })

    expect(
      (await repository.listAudit('user-a', project.id)).map(
        (event) => event.action,
      ),
    ).toEqual(['fact.created', 'property.created'])
    expect(await repository.listAudit('user-b', project.id)).toEqual([])
  })

  it('maps a property fact unique-index race to the stable conflict policy', async () => {
    const project = await createApartment(service, 'user-a')
    const input = {
      key: 'area.usable',
      label: 'Powierzchnia użytkowa',
      category: 'Powierzchnia',
      valueType: 'number' as const,
      value: 52,
      unit: 'm²',
      status: 'declared' as const,
      visibility: 'client' as const,
      sourceIds: [],
    }
    const existing = await repository.createFact(
      'user-a',
      project.id,
      input,
    )

    await expect(
      repository.createFact('user-a', project.id, input),
    ).rejects.toMatchObject({
      code: 'PROPERTY_FACT_SEMANTIC_CONFLICT',
      policy: 'preserve_existing_fact',
    })
    await expect(
      repository.listFacts('user-a', project.id),
    ).resolves.toEqual([existing])
  })

  it('maps an update unique-index race without mutating either fact', async () => {
    const project = await createApartment(service, 'user-a')
    const baseInput = {
      category: 'technical',
      valueType: 'text' as const,
      value: 'wartość',
      status: 'declared' as const,
      visibility: 'internal' as const,
      sourceIds: [],
    }
    const first = await repository.createFact('user-a', project.id, {
      ...baseInput,
      key: 'firstCustomFact',
      label: 'Pierwszy parametr',
    })
    const second = await repository.createFact('user-a', project.id, {
      ...baseInput,
      key: 'secondCustomFact',
      label: 'Drugi parametr',
    })
    if (!first || !second) throw new Error('FACT_SETUP_FAILED')

    await expect(
      repository.updateFact('user-a', project.id, second.id, {
        actorType: 'user',
        key: first.key,
      }),
    ).rejects.toMatchObject({
      code: 'PROPERTY_FACT_SEMANTIC_CONFLICT',
      policy: 'preserve_existing_fact',
    })
    await expect(
      repository.getFact('user-a', project.id, second.id),
    ).resolves.toEqual(second)
  })

  it('allows one winner for concurrent custom labels with different raw keys', async () => {
    const project = await createApartment(service, 'user-a')
    const baseInput = {
      category: 'technical',
      valueType: 'text' as const,
      value: 'wartość',
      status: 'declared' as const,
      visibility: 'internal' as const,
      sourceIds: [],
    }

    const results = await Promise.allSettled([
      repository.createFact('user-a', project.id, {
        ...baseInput,
        key: 'customTechnicalOne',
        label: 'Zażółć gęślą',
      }),
      repository.createFact('user-a', project.id, {
        ...baseInput,
        key: 'customTechnicalTwo',
        label: 'Zażółć-gęślą.',
      }),
    ])

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toEqual([
      expect.objectContaining({
        reason: expect.objectContaining({
          code: 'PROPERTY_FACT_SEMANTIC_CONFLICT',
          policy: 'preserve_existing_fact',
        }),
      }),
    ])
    await expect(repository.listFacts('user-a', project.id)).resolves.toHaveLength(
      1,
    )
  })
})

function createApartment(service: PropertyService, userId: string) {
  return service.createProject(userId, {
    title: `Mieszkanie Jeżyce ${userId}`,
    propertyType: 'apartment',
    transactionType: 'sale',
    city: 'Poznań',
    addressMode: 'hidden',
  })
}

function rejectFactMutationAudits(client: PGlite) {
  return client.exec(`
    ALTER TABLE property_audit_events
    ADD CONSTRAINT property_audit_reject_fact_mutations
    CHECK (action NOT IN ('fact.created', 'fact.updated'))
  `)
}
