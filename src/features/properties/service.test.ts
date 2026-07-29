import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryStudioEventRepository } from '../studio-events/memory-repository'
import { StudioEventService } from '../studio-events/service'
import { MemoryPropertyRepository } from './memory-repository'
import { PropertyService } from './service'

describe('PropertyService', () => {
  let repository: MemoryPropertyRepository
  let eventRepository: MemoryStudioEventRepository
  let service: PropertyService

  beforeEach(() => {
    repository = new MemoryPropertyRepository()
    eventRepository = new MemoryStudioEventRepository(repository)
    service = new PropertyService(
      repository,
      new StudioEventService(eventRepository),
    )
  })

  it('emits privacy-safe product events after successful domain writes', async () => {
    const project = await createApartment(service)
    await service.recordSessionStarted('user-a')
    await service.recordPropertyOpened('user-a', project.id)
    const fact = await service.createFact('user-a', project.id, {
      key: 'rooms.count',
      label: 'Liczba pokoi',
      category: 'Układ',
      valueType: 'number',
      value: 3,
      status: 'declared',
      visibility: 'client',
      sourceIds: [],
    })
    await service.updateFact('user-a', project.id, fact.id, {
      status: 'confirmed',
    })
    await service.updateProject('user-a', project.id, {
      stage: 'ready',
    })

    const events = await eventRepository.exportForUser('user-a')

    expect(events.map((event) => event.name)).toEqual([
      'property.created',
      'studio.session_started',
      'property.opened',
      'fact.created',
      'fact.updated',
      'property.ready_reached',
    ])
    expect(events[0].metadata).toEqual({
      propertyType: 'apartment',
      transactionType: 'sale',
      stage: 'draft',
    })
    expect(events[2].propertyProjectId).toBe(project.id)
    expect(events[3].metadata).toEqual({ factStatus: 'declared' })
    expect(events[4].metadata).toEqual({ factStatus: 'confirmed' })
  })

  it('keeps a successful domain write when telemetry fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failOpenService = new PropertyService(repository, {
      async record() {
        throw new Error('sensitive provider details')
      },
    })

    const project = await createApartment(failOpenService)

    expect(await failOpenService.getProject('user-a', project.id)).toEqual(
      project,
    )
    expect(log).toHaveBeenCalledWith('studio_event_write_failed')
    expect(log).not.toHaveBeenCalledWith(
      expect.stringContaining('sensitive'),
    )
    log.mockRestore()
  })

  it('isolates projects between users', async () => {
    const project = await service.createProject('user-a', {
      title: 'Działka Strzeszyn',
      propertyType: 'plot',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'approximate',
      plotIdentifier: 'PILOT-D-01',
    })

    await expect(service.getProject('user-b', project.id)).rejects.toThrow(
      'PROPERTY_NOT_FOUND',
    )
  })

  it('creates an audit event for a new fact', async () => {
    const project = await createApartment(service)

    await service.createFact('user-a', project.id, {
      key: 'area.usable',
      label: 'Powierzchnia użytkowa',
      category: 'Powierzchnia',
      valueType: 'number',
      value: 52.4,
      unit: 'm²',
      status: 'confirmed',
      visibility: 'public',
      sourceIds: [],
    })

    const exported = await repository.exportForUser('user-a')
    expect(exported.audit.map((event) => event.action)).toContain('fact.created')
  })

  it('uses the authenticated user as the fact confirmer', async () => {
    const project = await createApartment(service)

    const fact = await service.createFact('user-a', project.id, {
      key: 'rooms.count',
      label: 'Liczba pokoi',
      category: 'Układ',
      valueType: 'number',
      value: 3,
      status: 'confirmed',
      visibility: 'public',
      confirmedByUserId: 'forged-user',
      sourceIds: [],
    })

    expect(fact.confirmedByUserId).toBe('user-a')
    expect(fact.createdByType).toBe('user')
  })

  it('increments the version when a fact changes', async () => {
    const project = await createApartment(service)
    const fact = await service.createFact('user-a', project.id, {
      key: 'monthlyFees',
      label: 'Opłaty miesięczne',
      category: 'costs',
      valueType: 'money',
      value: 800,
      unit: 'PLN',
      status: 'declared',
      visibility: 'client',
      sourceIds: ['owner-declaration'],
    })

    const updated = await service.updateFact('user-a', project.id, fact.id, {
      value: 820,
      actorType: 'ai',
    })

    expect(updated.version).toBe(2)
    expect(updated.value).toBe(820)
    expect(updated.createdByType).toBe('user')
  })

  it('preserves fact sources and visibility when an update omits them', async () => {
    const project = await createApartment(service)
    const fact = await service.createFact('user-a', project.id, {
      key: 'area.usable',
      label: 'Powierzchnia użytkowa',
      category: 'Powierzchnia',
      valueType: 'number',
      value: 52.4,
      unit: 'm²',
      status: 'confirmed',
      visibility: 'client',
      sourceIds: ['source-document'],
    })

    const updated = await service.updateFact(
      'user-a',
      project.id,
      fact.id,
      { value: 53 },
    )

    expect(updated.sourceIds).toEqual(['source-document'])
    expect(updated.visibility).toBe('client')
  })

  it('keeps distinct before and after values in the audit trail', async () => {
    const project = await createApartment(service)
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

    await service.updateFact('user-a', project.id, fact.id, {
      value: 680000,
      actorType: 'user',
    })

    const exported = await repository.exportForUser('user-a')
    const updateEvent = exported.audit.find(
      (event) => event.action === 'fact.updated',
    )

    expect(updateEvent?.before).toMatchObject({ value: 700000, version: 1 })
    expect(updateEvent?.after).toMatchObject({ value: 680000, version: 2 })
  })

  it('does not expose another user data in an account export', async () => {
    await createApartment(service, 'user-a')
    await createApartment(service, 'user-b')

    const exported = await repository.exportForUser('user-a')

    expect(exported.projects).toHaveLength(1)
    expect(exported.projects[0].createdByUserId).toBe('user-a')
    expect(exported.audit.every((event) => event.actorId === 'user-a')).toBe(true)
  })

  it('lists property audit history newest first', async () => {
    const project = await createApartment(service)
    await service.createFact('user-a', project.id, {
      key: 'rooms.count',
      label: 'Liczba pokoi',
      category: 'Układ',
      valueType: 'number',
      value: 3,
      status: 'declared',
      visibility: 'client',
      sourceIds: [],
    })

    const history = await service.listAudit('user-a', project.id)

    expect(history.map((event) => event.action)).toEqual([
      'fact.created',
      'property.created',
    ])
  })

  it('does not expose audit history to another user', async () => {
    const project = await createApartment(service)

    await expect(service.listAudit('user-b', project.id)).rejects.toThrow(
      'PROPERTY_NOT_FOUND',
    )
  })
})

async function createApartment(
  service: PropertyService,
  userId = 'user-a',
) {
  return service.createProject(userId, {
    title: `Mieszkanie Jeżyce ${userId}`,
    propertyType: 'apartment',
    transactionType: 'sale',
    city: 'Poznań',
    addressMode: 'hidden',
  })
}
