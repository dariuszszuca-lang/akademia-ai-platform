import { describe, expect, it } from 'vitest'
import {
  allowedMetadataKeys,
  studioEventInputSchema,
  studioEventNameSchema,
} from './domain'

const organizationId = '11111111-1111-4111-8111-111111111111'
const propertyProjectId = '22222222-2222-4222-8222-222222222222'

describe('studio product event contract', () => {
  it('keeps a closed event catalog', () => {
    expect(
      studioEventNameSchema.safeParse('arbitrary.client.event')
        .success,
    ).toBe(false)
    expect(studioEventNameSchema.parse('fact.updated')).toBe(
      'fact.updated',
    )
  })

  it('rejects metadata outside the allowlist', () => {
    expect(() =>
      studioEventInputSchema.parse({
        organizationId,
        userId: 'user-a',
        propertyProjectId,
        name: 'fact.updated',
        contractVersion: 'studio-events-v1',
        metadata: { address: 'ul. Prywatna 1' },
      }),
    ).toThrow('STUDIO_EVENT_METADATA_NOT_ALLOWED')
  })

  it.each([
    { count: [1, 2] },
    { count: { exact: 2 } },
    { modelFamily: undefined },
  ])('rejects non-scalar metadata: %j', (metadata) => {
    expect(() =>
      studioEventInputSchema.parse({
        organizationId,
        userId: 'user-a',
        propertyProjectId,
        name: 'fact.updated',
        contractVersion: 'studio-events-v1',
        metadata,
      }),
    ).toThrow('STUDIO_EVENT_METADATA_NOT_ALLOWED')
  })

  it('accepts every allowlisted key with scalar values', () => {
    const metadata = Object.fromEntries(
      allowedMetadataKeys.map((key, index) => [
        key,
        index % 2 === 0 ? `value-${index}` : index,
      ]),
    )

    expect(
      studioEventInputSchema.parse({
        organizationId,
        userId: 'user-a',
        propertyProjectId,
        name: 'property.opened',
        contractVersion: 'studio-events-v1',
        metadata,
      }).metadata,
    ).toEqual(metadata)
  })
})
