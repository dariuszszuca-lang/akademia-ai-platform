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
      key: 'askingPrice',
      label: 'Cena ofertowa',
      category: 'price',
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
