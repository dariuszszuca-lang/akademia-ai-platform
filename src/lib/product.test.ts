import { describe, expect, it } from 'vitest'
import {
  PRODUCT_DESCRIPTION,
  PRODUCT_NAME,
  PRODUCT_NAVIGATION,
  isProductPathActive,
} from './product'

describe('Property Intelligence Studio product contract', () => {
  it('publishes the approved name and navigation', () => {
    expect(PRODUCT_NAME).toBe('Property Intelligence Studio')
    expect(PRODUCT_DESCRIPTION).toContain('nieruchomości')
    expect(PRODUCT_NAVIGATION).toEqual([
      { name: 'Pulpit', href: '/start' },
      { name: 'Portfolio', href: '/nieruchomosci' },
      { name: 'Zespół AI', href: '/agent' },
      { name: 'Profil', href: '/profil' },
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
