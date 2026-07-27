import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryPropertyRepository } from '../properties/memory-repository'
import { PropertyService } from '../properties/service'
import { MemoryPropertySourceRepository } from './memory-repository'
import { PropertySourceService } from './service'

describe('PropertySourceService', () => {
  let propertyRepository: MemoryPropertyRepository
  let sourceRepository: MemoryPropertySourceRepository
  let propertyService: PropertyService
  let sourceService: PropertySourceService

  beforeEach(() => {
    propertyRepository = new MemoryPropertyRepository()
    sourceRepository = new MemoryPropertySourceRepository(propertyRepository)
    propertyService = new PropertyService(propertyRepository)
    sourceService = new PropertySourceService(
      propertyRepository,
      sourceRepository,
    )
  })

  it('registers a tenant-scoped source with a trusted storage key', async () => {
    const project = await createApartment(propertyService, 'user-a')

    const source = await sourceService.registerSource(
      'user-a',
      project.id,
      {
        fileName: 'operat.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 12_000,
        checksumSha256: 'a'.repeat(64),
        id: 'forged-id',
        organizationId: 'forged-org',
        storageKey: 'public/forged.pdf',
        status: 'review_ready',
        createdByUserId: 'forged-user',
      },
    )

    expect(source.id).not.toBe('forged-id')
    expect(source.organizationId).toBe(project.organizationId)
    expect(source.storageKey).toBe(
      `organizations/${project.organizationId}/properties/${project.id}/sources/${source.id}/original`,
    )
    expect(source.status).toBe('upload_pending')
    expect(source.createdByUserId).toBe('user-a')
  })

  it('allows two source records with the same checksum', async () => {
    const project = await createApartment(propertyService, 'user-a')
    const input = {
      fileName: 'rzut.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 2_000,
      checksumSha256: 'b'.repeat(64),
    }

    const first = await sourceService.registerSource(
      'user-a',
      project.id,
      input,
    )
    const second = await sourceService.registerSource(
      'user-a',
      project.id,
      input,
    )

    expect(first.id).not.toBe(second.id)
    expect(await sourceService.listSources('user-a', project.id)).toHaveLength(
      2,
    )
  })

  it('lists sources newest first and returns a selected source', async () => {
    const project = await createApartment(propertyService, 'user-a')
    const first = await sourceService.registerSource('user-a', project.id, {
      fileName: 'pierwszy.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 1_000,
      checksumSha256: 'c'.repeat(64),
    })
    const second = await sourceService.registerSource('user-a', project.id, {
      fileName: 'drugi.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 1_500,
      checksumSha256: 'd'.repeat(64),
    })

    expect(
      (await sourceService.listSources('user-a', project.id)).map(
        (source) => source.id,
      ),
    ).toEqual([second.id, first.id])
    expect(
      await sourceService.getSource('user-a', project.id, second.id),
    ).toEqual(second)
  })

  it('does not expose or register sources across tenants', async () => {
    const project = await createApartment(propertyService, 'user-a')
    const source = await sourceService.registerSource('user-a', project.id, {
      fileName: 'umowa.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 3_000,
      checksumSha256: 'e'.repeat(64),
    })

    await expect(
      sourceService.listSources('user-b', project.id),
    ).rejects.toThrow('PROPERTY_NOT_FOUND')
    await expect(
      sourceService.getSource('user-b', project.id, source.id),
    ).rejects.toThrow('PROPERTY_NOT_FOUND')
    await expect(
      sourceService.registerSource('user-b', project.id, {
        fileName: 'atak.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 1,
        checksumSha256: 'f'.repeat(64),
      }),
    ).rejects.toThrow('PROPERTY_NOT_FOUND')
  })

  it('writes a user audit event for source registration', async () => {
    const project = await createApartment(propertyService, 'user-a')
    const source = await sourceService.registerSource('user-a', project.id, {
      fileName: 'księga.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 4_000,
      checksumSha256: '1'.repeat(64),
    })

    const event = (await propertyService.listAudit('user-a', project.id)).find(
      (candidate) => candidate.action === 'source.registered',
    )

    expect(event).toMatchObject({
      actorType: 'user',
      actorId: 'user-a',
      entityType: 'property_source',
      entityId: source.id,
    })
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
