export const PRODUCT_NAME = 'Property Intelligence Studio'
export const PRODUCT_SHORT_NAME = 'Property Studio'
export const PRODUCT_DESCRIPTION =
  'Prywatne studio danych, decyzji i materiałów dla agentów nieruchomości.'

export const PRODUCT_NAVIGATION = [
  { name: 'Pulpit', href: '/start' },
  { name: 'Portfolio', href: '/nieruchomosci' },
  { name: 'Zespół AI', href: '/agent' },
  { name: 'Profil', href: '/profil' },
] as const

export function isProductPathActive(pathname: string, href: string) {
  if (href === '/start') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}
