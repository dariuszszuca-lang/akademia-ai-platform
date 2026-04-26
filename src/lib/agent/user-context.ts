import { getProfilMd, getPersonaBuyerMd, getPersonaSellerMd } from '@/lib/onboarding/state'

export type UserContext = {
  profil: string | null
  personaBuyer: string | null
  personaSeller: string | null
  hasAny: boolean
}

export async function getUserContext(): Promise<UserContext> {
  const [profil, personaBuyer, personaSeller] = await Promise.all([
    getProfilMd(),
    getPersonaBuyerMd(),
    getPersonaSellerMd(),
  ])
  return {
    profil,
    personaBuyer,
    personaSeller,
    hasAny: Boolean(profil || personaBuyer || personaSeller),
  }
}

export function userContextAsBlock(ctx: UserContext): string {
  const parts: string[] = []
  if (ctx.profil) parts.push(`### profil.md\n\n${ctx.profil}`)
  if (ctx.personaBuyer) parts.push(`### persona-kupujacy.md\n\n${ctx.personaBuyer}`)
  if (ctx.personaSeller) parts.push(`### persona-sprzedajacy.md\n\n${ctx.personaSeller}`)
  if (parts.length === 0) {
    return '(Użytkownik nie ukończył jeszcze onboardingu, brak profilu i person. Daj odpowiedź ogólną i zaproponuj wypełnienie profilu.)'
  }
  return parts.join('\n\n')
}
