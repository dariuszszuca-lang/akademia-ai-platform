const legacySources = [
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
]

export const LEGACY_PRODUCT_REDIRECTS = legacySources.map((source) => ({
  source,
  destination: '/start',
  permanent: false,
}))
