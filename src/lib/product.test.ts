import { describe, expect, it } from 'vitest'
import {
  PLATFORM_NAME,
  PRODUCT_DESCRIPTION,
  PRODUCT_NAME,
  PRODUCT_NAVIGATION,
  isProductPathActive,
} from './product'

describe('Property Intelligence Studio product contract', () => {
  it('publishes the approved name and navigation', () => {
    expect(PRODUCT_NAME).toBe('Property Intelligence Studio')
    expect(PLATFORM_NAME).not.toMatch(/AI-Team|Akademia/i)
    expect(PRODUCT_DESCRIPTION).toContain('nieruchomości')
    expect(PRODUCT_NAVIGATION).toEqual([
      { name: 'Narzędzia', href: '/start' },
      { name: 'Studio', href: '/nieruchomosci' },
      { name: 'Zespół AI', href: '/agent' },
      { name: 'Plany', href: '/pricing' },
    ])
  })

  it('matches nested product routes without treating start as a prefix', () => {
    expect(isProductPathActive('/start', '/start')).toBe(true)
    expect(isProductPathActive('/start-old', '/start')).toBe(false)
    expect(
      isProductPathActive('/nieruchomosci/abc', '/nieruchomosci'),
    ).toBe(true)
  })
})
