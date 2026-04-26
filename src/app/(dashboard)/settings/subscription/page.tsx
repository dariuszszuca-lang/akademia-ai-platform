import Link from 'next/link'
import { getUserSubscription } from '@/lib/billing/state'
import { trialDaysLeft, PLAN_DISPLAY } from '@/lib/billing/plans'
import PortalButton from '@/components/billing/PortalButton'

export const dynamic = 'force-dynamic'

export default async function SubscriptionSettingsPage() {
  const sub = await getUserSubscription()
  const trialDays = trialDaysLeft(sub)
  const display = PLAN_DISPLAY.find(p => p.id === sub.plan)

  const statusLabel: Record<string, string> = {
    trialing: 'Trial',
    active: 'Aktywna',
    past_due: 'Płatność zaległa',
    canceled: 'Anulowana',
    incomplete: 'Niedokończona',
    expired: 'Wygasła',
    none: 'Brak',
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10 animate-fade-in-up">
      <header className="space-y-3">
        <p className="eyebrow">Subskrypcja</p>
        <h1 className="display-title text-foreground" style={{ fontSize: 'clamp(32px, 5vw, 48px)' }}>
          Twój <em>plan</em>.
        </h1>
      </header>

      {/* Current plan card */}
      <div className="p-6 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02]">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-foreground text-2xl font-medium">
            {sub.plan === 'trial' ? 'Trial (14 dni)' : display?.name ?? sub.plan}
          </h2>
          <span className="text-[11px] uppercase tracking-[0.25em] text-accent">
            {statusLabel[sub.status] ?? sub.status}
          </span>
        </div>

        {sub.status === 'trialing' && trialDays !== null && (
          <p className="text-foreground/60 text-sm mb-4">
            {trialDays > 0
              ? `Zostało Ci ${trialDays} ${trialDays === 1 ? 'dzień' : 'dni'} trialu. Wybierz plan żeby kontynuować po wygaśnięciu.`
              : 'Trial wygasł. Wybierz plan żeby odzyskać dostęp do agentów.'}
          </p>
        )}

        {sub.status === 'active' && sub.currentPeriodEnd && (
          <p className="text-foreground/60 text-sm mb-4">
            Plan odnawia się{' '}
            {new Date(sub.currentPeriodEnd).toLocaleDateString('pl-PL', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {sub.cancelAtPeriodEnd && ' · anulowanie zostało zaplanowane'}
          </p>
        )}

        {sub.status === 'past_due' && (
          <p className="text-amber-400 text-sm mb-4">
            Ostatnia płatność nie powiodła się. Zaktualizuj kartę w panelu Stripe.
          </p>
        )}

        <div className="flex gap-3 flex-wrap">
          {sub.stripeCustomerId ? (
            <PortalButton />
          ) : (
            <Link
              href="/pricing"
              className="px-5 py-2.5 bg-accent text-white text-sm font-medium rounded-full hover:bg-accent/90 transition"
            >
              Wybierz plan →
            </Link>
          )}
          <Link
            href="/pricing"
            className="px-5 py-2.5 text-foreground/60 hover:text-foreground text-sm border border-foreground/[0.12] rounded-full transition"
          >
            Zobacz wszystkie plany
          </Link>
        </div>
      </div>

      <div className="text-foreground/40 text-xs leading-relaxed">
        Pytania o fakturę / plan / cancel? Napisz na <a href="mailto:hello@akademia-ai.pl" className="text-accent hover:underline">hello@akademia-ai.pl</a>.
      </div>
    </div>
  )
}
