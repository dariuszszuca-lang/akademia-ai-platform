import { describe, expect, it } from 'vitest'
import { MemoryPropertyRepository } from '../properties/memory-repository'
import { PropertyService } from '../properties/service'
import { MemoryStudioEventRepository } from './memory-repository'
import { StudioEventService } from './service'

describe('StudioEventService', () => {
  it('records and lists only events visible to the project member', async () => {
    const properties = new MemoryPropertyRepository()
    const propertyService = new PropertyService(properties)
    const project = await createApartment(propertyService, 'user-a')
    const repository = new MemoryStudioEventRepository(properties)
    const service = new StudioEventService(repository)

    await service.record({
      organizationId: project.organizationId,
      userId: 'user-a',
      propertyProjectId: project.id,
      name: 'property.opened',
      contractVersion: 'studio-events-v1',
      metadata: { propertyType: 'apartment' },
    })

    expect(
      await service.listForProject('user-a', project.id),
    ).toMatchObject([{ name: 'property.opened' }])
    expect(
      await service.listForProject('user-b', project.id),
    ).toEqual([])
    expect(await service.exportForUser('user-a')).toHaveLength(1)
    expect(await service.exportForUser('user-b')).toEqual([])
  })

  it('rejects organization and project mismatches', async () => {
    const properties = new MemoryPropertyRepository()
    const propertyService = new PropertyService(properties)
    const projectA = await createApartment(propertyService, 'user-a')
    const projectB = await createApartment(propertyService, 'user-b')
    const service = new StudioEventService(
      new MemoryStudioEventRepository(properties),
    )

    await expect(
      service.record({
        organizationId: projectB.organizationId,
        userId: 'user-a',
        propertyProjectId: projectA.id,
        name: 'fact.updated',
        contractVersion: 'studio-events-v1',
        metadata: { factStatus: 'declared' },
      }),
    ).rejects.toThrow('STUDIO_EVENT_CONTEXT_MISMATCH')
  })

  it('reparses input before calling the repository', async () => {
    const appendCalls: unknown[] = []
    const service = new StudioEventService({
      async append(input) {
        appendCalls.push(input)
        throw new Error('APPEND_SHOULD_NOT_RUN')
      },
      async listForProject() {
        return []
      },
      async exportForUser() {
        return []
      },
    })

    await expect(
      service.record({
        organizationId:
          '11111111-1111-4111-8111-111111111111',
        userId: 'user-a',
        name: 'fact.updated',
        contractVersion: 'studio-events-v1',
        metadata: { evidenceText: 'private' },
      } as never),
    ).rejects.toThrow('STUDIO_EVENT_METADATA_NOT_ALLOWED')
    expect(appendCalls).toEqual([])
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
