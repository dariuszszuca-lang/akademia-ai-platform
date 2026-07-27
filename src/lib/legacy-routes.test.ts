import { describe, expect, it } from 'vitest'
import { LEGACY_PRODUCT_REDIRECTS } from './legacy-routes.mjs'

describe('legacy product redirects', () => {
  it('redirects every removed product area to the studio dashboard', () => {
    expect(LEGACY_PRODUCT_REDIRECTS).toEqual(
      [
        '/classroom/:path*',
        '/programy/:path*',
        '/community/:path*',
        '/spolecznosc/:path*',
        '/ludzie/:path*',
        '/members/:path*',
        '/skarbiec/:path*',
        '/calendar/:path*',
        '/na-zywo/:path*',
        '/about/:path*',
        '/o-akademii/:path*',
        '/raporty/koszty/:path*',
      ].map((source) => ({
        source,
        destination: '/start',
        permanent: false,
      })),
    )
  })
})
