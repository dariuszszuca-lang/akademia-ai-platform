import { describe, expect, it } from 'vitest'
import {
  createPropertyFactSchema,
  createPropertySchema,
  updatePropertyFactSchema,
  updatePropertySchema,
} from './domain'

describe('createPropertySchema', () => {
  it('accepts the minimum private listing and defaults its stage', () => {
    const parsed = createPropertySchema.parse({
      title: 'Mieszkanie Jeżyce',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })

    expect(parsed.stage).toBe('draft')
    expect(parsed.address).toBeUndefined()
  })

  it('rejects exact address mode without an address', () => {
    const parsed = createPropertySchema.safeParse({
      title: 'Mieszkanie Jeżyce',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'exact',
    })

    expect(parsed.success).toBe(false)
  })

  it('rejects an exact address containing only whitespace', () => {
    const parsed = createPropertySchema.safeParse({
      title: 'Mieszkanie Jeżyce',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'exact',
      address: '   ',
    })

    expect(parsed.success).toBe(false)
  })
})

describe('updatePropertySchema', () => {
  it('accepts a partial update without requiring creation fields', () => {
    const parsed = updatePropertySchema.parse({
      stage: 'verification',
    })

    expect(parsed).toEqual({ stage: 'verification' })
  })
})

describe('property fact schemas', () => {
  it('requires evidence or a confirming user for confirmed status', () => {
    const parsed = createPropertyFactSchema.safeParse({
      key: 'usableArea',
      label: 'Powierzchnia użytkowa',
      category: 'areas',
      valueType: 'number',
      value: 52.4,
      unit: 'm2',
      status: 'confirmed',
      visibility: 'public',
    })

    expect(parsed.success).toBe(false)
  })

  it('accepts an owner declaration without confirmation', () => {
    const parsed = createPropertyFactSchema.parse({
      key: 'monthlyFees',
      label: 'Opłaty miesięczne',
      category: 'costs',
      valueType: 'money',
      value: 820,
      unit: 'PLN',
      status: 'declared',
      visibility: 'client',
      sourceIds: ['source-owner-statement'],
    })

    expect(parsed.status).toBe('declared')
  })

  it('does not allow AI to confirm its own inference without evidence', () => {
    const parsed = updatePropertyFactSchema.safeParse({
      status: 'confirmed',
      actorType: 'ai',
      sourceIds: [],
    })

    expect(parsed.success).toBe(false)
  })

  it('allows a user to confirm a fact explicitly', () => {
    const parsed = updatePropertyFactSchema.parse({
      status: 'confirmed',
      actorType: 'user',
      confirmedByUserId: 'user-a',
      sourceIds: [],
    })

    expect(parsed.status).toBe('confirmed')
  })
})
