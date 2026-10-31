import { PLAN_DISPLAY } from '@/lib/billing/plans'
import { getBillingMode } from '@/lib/billing/mode'
import { getUserSubscription } from '@/lib/billing/state'
import PricingCards from '@/components/billing/PricingCards'

export const dynamic = 'force-dynamic'

export default async function PricingPage() {
  const sub = await getUserSubscription()
  const billingMode = getBillingMode()

  return (
    <div className="mx-auto max-w-5xl space-y-12 animate-fade-in-up">
      <header className="space-y-4 text-center">
        <p className="eyebrow">Plany</p>
        <h1 className="display-title text-foreground" style={{ fontSize: 'clamp(36px, 5.5vw, 56px)' }}>
          Trzy plany, ceny w przygotowaniu.
        </h1>
        <p className="text-foreground/55 text-base leading-relaxed max-w-2xl mx-auto">
          Dziś wszystkie narzędzia są dostępne bez opłat. Plany pokazują, jak podzielimy dostęp,
          gdy ruszą płatności. Kwoty podamy osobno.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/30 text-accent text-sm">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
          Dostęp bez opłat na czas startu
        </div>
      </header>

      <PricingCards
        plans={PLAN_DISPLAY}
        currentPlan={billingMode === 'pilot' ? 'pro' : sub.plan}
        billingMode={billingMode}
      />

      <div className="text-center text-foreground/40 text-xs">
        {billingMode === 'pilot'
          ? 'Płatności są wyłączone. Włączymy je po ustaleniu cen.'
          : 'Płatność miesięczna · Anulujesz w każdej chwili w panelu Stripe · Faktura VAT na firmę'}
      </div>
    </div>
  )
}
