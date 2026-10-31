import { describe, expect, it } from 'vitest'
import { MAX_RESULTS_PER_PROPERTY } from './domain'
import { createToolResultService, ToolResultError } from './service'

function setup(owned = true) {
  const data = new Map<string, unknown>()
  let n = 0
  const service = createToolResultService({
    store: {
      get: async <T,>(key: string) => (data.get(key) as T) ?? null,
      set: async (key, value) => {
        data.set(key, value)
      },
    },
    ownsProperty: async () => owned,
    now: () => new Date('2026-10-31T10:00:00Z'),
    newId: () => `id-${++n}`,
  })
  return { service, data }
}

const valid = {
  propertyId: 'p1',
  toolId: 'rejestr-cen',
  title: 'Ceny: miasto Gdańsk, 12 mies.',
  summary: { mediana: 14200, liczba: 812 },
}

describe('tool results', () => {
  it('saves newest first and lists them for the owner', async () => {
    const { service } = setup()
    await service.save('u1', valid)
    await service.save('u1', { ...valid, title: 'drugi' })
    const list = await service.list('u1', 'p1')
    expect(list.map((r) => r.title)).toEqual(['drugi', valid.title])
    expect(list[0]).toMatchObject({ id: 'id-2', createdAt: '2026-10-31T10:00:00.000Z' })
  })

  it('refuses a property the user does not own', async () => {
    const { service } = setup(false)
    await expect(service.save('u1', valid)).rejects.toMatchObject({ code: 'not_found' })
    await expect(service.list('u1', 'p1')).rejects.toBeInstanceOf(ToolResultError)
  })

  it('rejects a PESEL in the summary so personal data stays in the browser', async () => {
    const { service } = setup()
    await expect(
      service.save('u1', { ...valid, summary: { wlasciciel: 'Jan 80010112345' } }),
    ).rejects.toMatchObject({ code: 'invalid' })
  })

  it('rejects unknown tools and oversized summaries', async () => {
    const { service } = setup()
    await expect(service.save('u1', { ...valid, toolId: 'inne' })).rejects.toMatchObject({ code: 'invalid' })
    const big = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`k${i}`, i]))
    await expect(service.save('u1', { ...valid, summary: big })).rejects.toMatchObject({ code: 'invalid' })
  })

  it('keeps at most the limit of results per property', async () => {
    const { service } = setup()
    for (let i = 0; i < MAX_RESULTS_PER_PROPERTY + 3; i++) await service.save('u1', valid)
    expect(await service.list('u1', 'p1')).toHaveLength(MAX_RESULTS_PER_PROPERTY)
  })
})
