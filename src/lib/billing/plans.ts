/**
 * Plany platformy nieruchomości.
 *
 * Ceny: BRAK. Darek ustali je osobno (decyzja 31.10.2026). Pole `price` zostaje puste,
 * `priceMonthly` = 0 do czasu decyzji. Nie wpisuj tu kwot.
 *
 * Trial: 14 dni od pierwszego logowania, pełne funkcje Pro.
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
  priceMonthly: number // zł; 0 = cena nieustalona
  description: string
  features: string[]
  highlight?: boolean
  ctaLabel: string
}

export const PLAN_DISPLAY: PlanDisplay[] = [
  {
    id: 'starter',
    name: 'Start',
    price: '',
    priceMonthly: 0,
    description: 'Dla właściciela albo najemcy z jedną sprawą.',
    features: [
      'Rejestr cen transakcyjnych',
      'Protokół z telefonu: wydanie i zwrot',
      'Księga wieczysta po ludzku',
      'Spacer 3D z rzutu',
      'Jedna teczka nieruchomości',
    ],
    ctaLabel: 'Wybierz Start',
  },
  {
    id: 'pro',
    name: 'Agent',
    price: '',
    priceMonthly: 0,
    description: 'Dla agenta z wieloma ofertami.',
    features: [
      'Wszystko ze Start',
      'Property Intelligence Studio bez limitu teczek',
      'Zespół AI z bazą prawną',
      'Profil i persony klientów',
      'Wyniki narzędzi zapisane w teczce',
    ],
    highlight: true,
    ctaLabel: 'Wybierz Agent',
  },
  {
    id: 'agency',
    name: 'Biuro',
    price: '',
    priceMonthly: 0,
    description: 'Dla biur i zespołów.',
    features: [
      'Wszystko z Agent',
      'Do 5 osób w zespole',
      'Wspólne teczki i historia zmian',
      'Własna identyfikacja zespołu',
      'Opiekun wdrożenia',
    ],
    ctaLabel: 'Porozmawiajmy',
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
