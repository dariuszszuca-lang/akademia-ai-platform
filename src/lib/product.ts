/**
 * Nazwy produktów platformy.
 *
 * PLATFORM_NAME to nazwa robocza. Darek wybierze docelową (31.10.2026: „coś wymyślimy”).
 * PRODUCT_NAME to Teczka nieruchomości jako produkt: Property Intelligence Studio.
 */
export const PLATFORM_NAME = 'Platforma nieruchomości'
export const PLATFORM_DESCRIPTION =
  'Narzędzia dla właścicieli, kupujących, wynajmujących i agentów: rejestr cen, protokół, księga wieczysta, spacer 3D.'

export const PRODUCT_NAME = 'Property Intelligence Studio'
export const PRODUCT_SHORT_NAME = 'Property Studio'
export const PRODUCT_DESCRIPTION =
  'Prywatne studio danych, decyzji i materiałów dla agentów nieruchomości.'

export const PRODUCT_NAVIGATION = [
  { name: 'Narzędzia', href: '/start' },
  { name: 'Studio', href: '/nieruchomosci' },
  { name: 'Zespół AI', href: '/agent' },
  { name: 'Plany', href: '/pricing' },
] as const

export function isProductPathActive(pathname: string, href: string) {
  if (href === '/start') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}
