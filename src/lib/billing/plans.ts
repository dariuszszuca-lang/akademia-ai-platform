/**
 * Plany subskrypcji Akademia AI.
 *
 * Trial: 14 dni od pierwszego logowania, pełne funkcje Pro.
 * Starter: 99 zł/mies, ograniczone.
 * Pro: 199 zł/mies, pełne funkcje + RAG legal + Persona Path A.
 * Agency: 499 zł/mies, nielimitowane, multi-user, white-label.
 */

export type PlanId = 'trial' | 'starter' | 'pro' | 'agency'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'expired'
  | 'none'

export type UserSubscription = {
  plan: PlanId
  status: SubscriptionStatus
  trialStart?: string
  trialEnd?: string
  currentPeriodEnd?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  cancelAtPeriodEnd?: boolean
}

export type PlanFeatures = {
  dailyLimit: number // wywolania agenta dziennie (Infinity = nielimitowane)
  ragLegal: boolean // RAG na Kodeksie cywilnym (agent prawny)
  pathA: boolean // AI proponuje 3 typy klientow
  models: ('haiku' | 'sonnet' | 'opus')[]
  multiUser: boolean
}

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  trial: {
    dailyLimit: 200,
    ragLegal: true,
    pathA: true,
    models: ['sonnet', 'haiku'],
    multiUser: false,
  },
  starter: {
    dailyLimit: 50,
    ragLegal: false,
    pathA: false,
    models: ['sonnet', 'haiku'],
    multiUser: false,
  },
  pro: {
    dailyLimit: 200,
    ragLegal: true,
    pathA: true,
    models: ['sonnet', 'haiku'],
    multiUser: false,
  },
  agency: {
    dailyLimit: Infinity,
    ragLegal: true,
    pathA: true,
    models: ['sonnet', 'haiku', 'opus'],
    multiUser: true,
  },
}

export type PlanDisplay = {
  id: PlanId
  name: string
  price: string
  priceMonthly: number // zł
  description: string
  features: string[]
  highlight?: boolean
  ctaLabel: string
}

export const PLAN_DISPLAY: PlanDisplay[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '99 zł',
    priceMonthly: 99,
    description: 'Dla agenta który dopiero zaczyna z AI.',
    features: [
      '50 wywołań agenta / dzień',
      'Wszystkie 6 agentów (CEO, Marketing, Wycena, Publikacja, Nieruchomości, Prawny*)',
      'Profil + persony (Path B)',
      'Bez bazy prawnej (RAG)',
      'Email support',
    ],
    ctaLabel: 'Zacznij Starter →',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '199 zł',
    priceMonthly: 199,
    description: 'Pełne wykorzystanie. Najczęstszy wybór.',
    features: [
      '200 wywołań agenta / dzień',
      'Wszystkie agenty + RAG na Kodeksie cywilnym',
      'Persona Path A (AI proponuje 3 typy)',
      'Profil pogłębiony (20 dodatkowych pytań)',
      'Priorytetowy support',
    ],
    highlight: true,
    ctaLabel: 'Zacznij Pro →',
  },
  {
    id: 'agency',
    name: 'Agency',
    price: '499 zł',
    priceMonthly: 499,
    description: 'Dla biur i zespołów.',
    features: [
      'Nielimitowane wywołania',
      'Wszystkie agenty + Opus dla trudnych spraw prawnych',
      'Multi-user (do 5 agentów w zespole)',
      'White-label (Twoje logo)',
      'Dedykowany account manager',
    ],
    ctaLabel: 'Skontaktuj się →',
  },
]

/**
 * Sprawdza czy plan ma daną funkcję.
 */
export function planHas(plan: PlanId, feature: keyof PlanFeatures): boolean {
  const f = PLAN_FEATURES[plan][feature]
  if (typeof f === 'boolean') return f
  if (typeof f === 'number') return f > 0
  return Array.isArray(f) ? f.length > 0 : Boolean(f)
}

/**
 * Status aktywny = user ma dostęp do funkcji planu.
 */
export function isPlanActive(sub: UserSubscription): boolean {
  if (sub.status === 'trialing') {
    if (sub.trialEnd && new Date(sub.trialEnd) > new Date()) return true
    return false
  }
  return sub.status === 'active'
}

/**
 * Domyślny stan dla nowego usera (start trialu).
 */
export function newTrialSubscription(): UserSubscription {
  const now = new Date()
  const trialEnd = new Date(now)
  trialEnd.setDate(trialEnd.getDate() + 14)
  return {
    plan: 'trial',
    status: 'trialing',
    trialStart: now.toISOString(),
    trialEnd: trialEnd.toISOString(),
  }
}

/**
 * Ile dni zostało do końca trialu.
 */
export function trialDaysLeft(sub: UserSubscription): number | null {
  if (sub.status !== 'trialing' || !sub.trialEnd) return null
  const ms = new Date(sub.trialEnd).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}
