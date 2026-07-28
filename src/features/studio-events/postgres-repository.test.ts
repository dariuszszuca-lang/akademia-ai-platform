import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PostgresPropertyRepository } from '../properties/postgres-repository'
import { PropertyService } from '../properties/service'
import { PostgresStudioEventRepository } from './postgres-repository'
import { StudioEventService } from './service'

describe('PostgresStudioEventRepository', () => {
  let client: PGlite
  let propertyService: PropertyService
  let events: StudioEventService

  beforeEach(async () => {
    client = new PGlite()
    const database = drizzle(client)
    await migrate(database, { migrationsFolder: './drizzle' })
    propertyService = new PropertyService(
      new PostgresPropertyRepository(database),
    )
    events = new StudioEventService(
      new PostgresStudioEventRepository(database),
    )
  })

  afterEach(async () => {
    await client.close()
  })

  it('isolates project events and exports only member organizations', async () => {
    const projectA = await createApartment(propertyService, 'user-a')
    await createApartment(propertyService, 'user-b')

    await events.record({
      organizationId: projectA.organizationId,
      userId: 'user-a',
      propertyProjectId: projectA.id,
      name: 'property.opened',
      contractVersion: 'studio-events-v1',
      metadata: {
        propertyType: 'apartment',
        transactionType: 'sale',
      },
    })

    expect(
      await events.listForProject('user-a', projectA.id),
    ).toMatchObject([{ name: 'property.opened' }])
    expect(
      await events.listForProject('user-b', projectA.id),
    ).toEqual([])
    expect(await events.exportForUser('user-a')).toHaveLength(1)
    expect(await events.exportForUser('user-b')).toEqual([])
  })

  it('rejects an organization id that does not own the project', async () => {
    const projectA = await createApartment(propertyService, 'user-a')
    const projectB = await createApartment(propertyService, 'user-b')

    await expect(
      events.record({
        organizationId: projectB.organizationId,
        userId: 'user-a',
        propertyProjectId: projectA.id,
        name: 'fact.updated',
        contractVersion: 'studio-events-v1',
        metadata: { factStatus: 'declared' },
      }),
    ).rejects.toThrow('STUDIO_EVENT_CONTEXT_MISMATCH')
    expect(await events.exportForUser('user-a')).toEqual([])
    expect(await events.exportForUser('user-b')).toEqual([])
  })
})

function createApartment(service: PropertyService, userId: string) {
  return service.createProject(userId, {
    title: `Syntetyczne mieszkanie ${userId}`,
    propertyType: 'apartment',
    transactionType: 'sale',
    city: 'Testowo',
    addressMode: 'hidden',
  })
}
