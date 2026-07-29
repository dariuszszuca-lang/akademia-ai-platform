import { describe, expect, it } from 'vitest'
import { MemoryPropertyRepository } from './memory-repository'
import { createPropertyHttpHandlers } from './http'
import { PropertyService } from './service'

function setup(userId: string | null = 'user-a') {
  const repository = new MemoryPropertyRepository()
  const service = new PropertyService(repository)
  const handlers = createPropertyHttpHandlers({
    getService: () => service,
    getUserId: async () => userId,
  })

  return { handlers, service }
}

function jsonRequest(method: string, body: unknown) {
  return new Request('http://localhost/api/properties', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('property HTTP handlers', () => {
  it('returns 401 before reading the request body when session is missing', async () => {
    const { handlers } = setup(null)
    const request = new Request('http://localhost/api/properties', {
      method: 'POST',
      body: '{invalid-json',
    })

    const response = await handlers.createProject(request)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' })
  })

  it('creates and lists projects for the authenticated user', async () => {
    const { handlers } = setup()
    const createdResponse = await handlers.createProject(
      jsonRequest('POST', {
        title: 'Mieszkanie Jeżyce',
        propertyType: 'apartment',
        transactionType: 'sale',
        city: 'Poznań',
        addressMode: 'hidden',
      }),
    )
    const createdBody = await createdResponse.json()
    const listResponse = await handlers.listProjects()
    const listBody = await listResponse.json()

    expect(createdResponse.status).toBe(201)
    expect(createdBody.project.title).toBe('Mieszkanie Jeżyce')
    expect(listBody.projects).toHaveLength(1)
  })

  it('returns 400 with safe validation details for invalid input', async () => {
    const { handlers } = setup()

    const response = await handlers.createProject(
      jsonRequest('POST', {
        title: 'A',
        propertyType: 'apartment',
        transactionType: 'sale',
        city: 'P',
        addressMode: 'hidden',
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('validation_error')
    expect(body.issues).toEqual(expect.any(Array))
    expect(JSON.stringify(body)).not.toContain('Mieszkanie')
  })

  it('returns 404 for a project owned by another user', async () => {
    const repository = new MemoryPropertyRepository()
    const service = new PropertyService(repository)
    const project = await service.createProject('user-a', {
      title: 'Dom Sołacz',
      propertyType: 'house',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })
    const handlers = createPropertyHttpHandlers({
      getService: () => service,
      getUserId: async () => 'user-b',
    })

    const response = await handlers.getProject(new Request('http://localhost'), {
      params: Promise.resolve({ propertyId: project.id }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'not_found' })
  })

  it('creates, lists and updates facts through the API boundary', async () => {
    const { handlers, service } = setup()
    const project = await service.createProject('user-a', {
      title: 'Działka Strzeszyn',
      propertyType: 'plot',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'approximate',
    })
    const context = { params: Promise.resolve({ propertyId: project.id }) }
    const createdResponse = await handlers.createFact(
      jsonRequest('POST', {
        key: 'plotArea',
        label: 'Powierzchnia działki',
        category: 'areas',
        valueType: 'number',
        value: 920,
        unit: 'm2',
        status: 'declared',
        visibility: 'public',
        sourceIds: ['owner-declaration'],
      }),
      context,
    )
    const { fact } = await createdResponse.json()
    const updatedResponse = await handlers.updateFact(
      jsonRequest('PATCH', { status: 'confirmed' }),
      {
        params: Promise.resolve({
          propertyId: project.id,
          factId: fact.id,
        }),
      },
    )
    const listResponse = await handlers.listFacts(
      new Request('http://localhost'),
      context,
    )
    const listBody = await listResponse.json()

    expect(createdResponse.status).toBe(201)
    expect(updatedResponse.status).toBe(200)
    expect(listBody.facts).toHaveLength(1)
    expect(listBody.facts[0]).toMatchObject({
      status: 'confirmed',
      confirmedByUserId: 'user-a',
      version: 2,
    })
  })

  it('rejects malformed metadata for a catalog fact before writing', async () => {
    const { handlers, service } = setup()
    const project = await service.createProject('user-a', {
      title: 'Mieszkanie Jeżyce',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })

    const response = await handlers.createFact(
      jsonRequest('POST', {
        key: 'area.usable',
        label: 'Powierzchnia użytkowa',
        category: 'areas',
        valueType: 'text',
        value: '52,4',
        status: 'declared',
        visibility: 'internal',
        sourceIds: [],
      }),
      { params: Promise.resolve({ propertyId: project.id }) },
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('validation_error')
    expect(body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'custom',
          message: 'CATALOG_FACT_METADATA_INVALID',
        }),
      ]),
    )
    await expect(service.listFacts('user-a', project.id)).resolves.toEqual([])
  })

  it('rejects a catalog fact unsupported by the property type before writing', async () => {
    const { handlers, service } = setup()
    const project = await service.createProject('user-a', {
      title: 'Mieszkanie Jeżyce',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })

    const response = await handlers.createFact(
      jsonRequest('POST', {
        key: 'plot.area',
        label: 'Powierzchnia działki',
        category: 'Działka',
        valueType: 'number',
        value: 920,
        unit: 'm²',
        status: 'declared',
        visibility: 'internal',
        sourceIds: [],
      }),
      { params: Promise.resolve({ propertyId: project.id }) },
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('validation_error')
    expect(body.issues).toEqual([
      expect.objectContaining({
        code: 'custom',
        message: 'CATALOG_FACT_PROPERTY_TYPE_UNSUPPORTED',
        path: ['key'],
      }),
    ])
    await expect(service.listFacts('user-a', project.id)).resolves.toEqual([])
  })
})
