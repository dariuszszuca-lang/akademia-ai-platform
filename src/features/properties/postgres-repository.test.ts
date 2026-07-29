import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PostgresPropertyRepository } from './postgres-repository'
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
