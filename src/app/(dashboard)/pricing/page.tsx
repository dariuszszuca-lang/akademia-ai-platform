import { PLAN_DISPLAY } from '@/lib/billing/plans'
import { getUserSubscription } from '@/lib/billing/state'
import { trialDaysLeft } from '@/lib/billing/plans'
import PricingCards from '@/components/billing/PricingCards'

export const dynamic = 'force-dynamic'

export default async function PricingPage() {
  const sub = await getUserSubscription()
  const trialDays = trialDaysLeft(sub)

  return (
    <div className="mx-auto max-w-5xl space-y-12 animate-fade-in-up">
      <header className="space-y-4 text-center">
        <p className="eyebrow">Plany</p>
        <h1 className="display-title text-foreground" style={{ fontSize: 'clamp(36px, 5.5vw, 56px)' }}>
          Wybierz <em>swój plan</em>.
        </h1>
        <p className="text-foreground/55 text-base leading-relaxed max-w-2xl mx-auto">
          Wszystkie plany pozwalają korzystać z 6 agentów AI. Różnią się limitami dziennymi i dodatkowymi funkcjami (RAG na Kodeksie cywilnym, Persona Path A, multi-user).
        </p>

        {sub.status === 'trialing' && trialDays !== null && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/30 text-accent text-sm">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Trial · {trialDays} {trialDays === 1 ? 'dzień' : 'dni'} pozostało
          </div>
        )}
      </header>

      <PricingCards plans={PLAN_DISPLAY} currentPlan={sub.plan} />

      <div className="text-center text-foreground/40 text-xs">
        Płatność miesięczna · Anulujesz w każdej chwili w panelu Stripe · Faktura VAT na firmę
      </div>
    </div>
  )
}
