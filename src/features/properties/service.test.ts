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
      plotIdentifier: 'PILOT-D-01',
    })

    await expect(service.getProject('user-b', project.id)).rejects.toThrow(
      'PROPERTY_NOT_FOUND',
    )
  })

  it('creates an audit event for a new fact', async () => {
    const project = await createApartment(service)

    await service.createFact('user-a', project.id, {
      key: 'usableArea',
      label: 'Powierzchnia użytkowa',
      category: 'areas',
      valueType: 'number',
      value: 52.4,
      unit: 'm2',
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
      key: 'rooms',
      label: 'Liczba pokoi',
      category: 'layout',
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

  it('keeps distinct before and after values in the audit trail', async () => {
    const project = await createApartment(service)
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
