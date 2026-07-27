import { describe, expect, it } from 'vitest'
import { readPropertySourceCallbackConfig } from './callback-config'

describe('property source callback runtime configuration', () => {
  it('requires a callback secret of at least 32 characters', () => {
    expect(() => readPropertySourceCallbackConfig({})).toThrow(
      'Missing runtime variable: PROPERTY_SOURCE_CALLBACK_SECRET',
    )
    expect(() =>
      readPropertySourceCallbackConfig({
        PROPERTY_SOURCE_CALLBACK_SECRET: 'too-short',
      }),
    ).toThrow(
      'Invalid runtime variable: PROPERTY_SOURCE_CALLBACK_SECRET',
    )
  })

  it('returns a valid secret without reading static AWS credentials', () => {
    const environment = new Proxy(
      { PROPERTY_SOURCE_CALLBACK_SECRET: 'x'.repeat(32) },
      {
        get(target, property, receiver) {
          if (
            property === 'AWS_ACCESS_KEY_ID' ||
            property === 'AWS_SECRET_ACCESS_KEY'
          ) {
            throw new Error('Static credential variable was read')
          }
          return Reflect.get(target, property, receiver)
        },
      },
    )

    expect(readPropertySourceCallbackConfig(environment)).toEqual({
      secret: 'x'.repeat(32),
    })
  })

  it('does not include the supplied value in a validation error', () => {
    const supplied = 'sensitive-short-value'

    expect(() =>
      readPropertySourceCallbackConfig({
        PROPERTY_SOURCE_CALLBACK_SECRET: supplied,
      }),
    ).toThrow('Invalid runtime variable: PROPERTY_SOURCE_CALLBACK_SECRET')

    try {
      readPropertySourceCallbackConfig({
        PROPERTY_SOURCE_CALLBACK_SECRET: supplied,
      })
    } catch (error) {
      expect(error instanceof Error ? error.message : String(error)).not.toContain(
        supplied,
      )
    }
  })
})
