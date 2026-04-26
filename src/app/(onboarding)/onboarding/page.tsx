import Link from 'next/link'
import { getOnboardingState, getProfilMd, getPersonaBuyerMd, getPersonaSellerMd } from '@/lib/onboarding/state'
import { expressQuestions } from '@/data/onboarding/express'
import { deepQuestions } from '@/data/onboarding/deep'
import SkipOnboardingButton from '@/components/onboarding/SkipOnboardingButton'

export const dynamic = 'force-dynamic'

export default async function OnboardingWelcome() {
  const state = await getOnboardingState()
  const [profilMdRaw, buyerMd, sellerMd] = await Promise.all([
    getProfilMd(),
    getPersonaBuyerMd(),
    getPersonaSellerMd(),
  ])
  const hasProfil = Boolean(profilMdRaw)
  const hasBuyer = Boolean(buyerMd)
  const hasSeller = Boolean(sellerMd)

  const expressDone = expressQuestions.every(q => state.expressAnswers[q.id]?.trim())
  const expressInProgress = !expressDone && Object.keys(state.expressAnswers).length > 0
  const deepDone = Boolean(state.deepGeneratedAt) && deepQuestions.every(q => state.deepAnswers[q.id]?.trim())
  const deepInProgress = !deepDone && Object.keys(state.deepAnswers).length > 0

  return (
    <div className="max-w-2xl mx-auto py-16 sm:py-24 space-y-12 animate-fade-in-up">
      <div className="space-y-6">
        <div className="text-[11px] uppercase tracking-[0.3em] text-accent">
          Onboarding
        </div>
        <h1 className="text-foreground text-4xl sm:text-5xl font-medium leading-tight tracking-tight">
          Stwórzmy razem Twój profil.
        </h1>
        <p className="text-foreground/55 text-lg leading-relaxed max-w-xl">
          AI pozna Cię w 20 minut. Każdy kolejny agent na platformie (CEO, Marketing,
          Prawny, Wycena, Publikacja) będzie odpowiadał w Twoich realiach. Bez generycznych
          rad. Konkretnie pod Twój rynek, klienta, cele.
        </p>
      </div>

      <div className="space-y-3 stagger-children">
        <Step
          number={1}
          title="Profil agenta"
          subtitle="15 pytań w 3 częściach"
          time="~20 min"
          status={expressDone ? 'done' : expressInProgress ? 'progress' : 'pending'}
          href="/onboarding/express"
          ctaLabel={expressDone ? 'Zobacz profil' : expressInProgress ? 'Kontynuuj' : 'Zacznij'}
        />
        <Step
          number={2}
          title="Persona klienta kupującego"
          subtitle="Chat z AI, 6 pytań"
          time="~10 min"
          status={hasBuyer ? 'done' : hasProfil ? 'pending' : 'locked'}
          href="/onboarding/persona/buyer"
          ctaLabel={hasBuyer ? 'Zobacz personę' : 'Zacznij'}
          disabledHint={hasProfil ? undefined : 'Wymaga profilu'}
        />
        <Step
          number={3}
          title="Persona klienta sprzedającego"
          subtitle="Chat z AI, 6 pytań"
          time="~10 min"
          status={hasSeller ? 'done' : hasBuyer ? 'pending' : 'locked'}
          href="/onboarding/persona/seller"
          ctaLabel={hasSeller ? 'Zobacz personę' : 'Zacznij'}
          disabledHint={hasBuyer ? undefined : 'Najpierw kupujący'}
        />
        <Step
          number={4}
          title="Profil pogłębiony (opcja)"
          subtitle="20 pytań, dodatkowe sekcje"
          time="~30 min"
          status={deepDone ? 'done' : deepInProgress ? 'progress' : (hasBuyer && hasSeller) ? 'pending' : 'locked'}
          href="/onboarding/deep"
          ctaLabel={deepDone ? 'Zobacz profil' : deepInProgress ? 'Kontynuuj' : 'Zacznij'}
          disabledHint={(hasBuyer && hasSeller) ? undefined : 'Po obu personach'}
        />
      </div>

      <div className="pt-4 border-t border-foreground/[0.06] flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <p className="text-foreground/30 text-xs leading-relaxed">
          Wszystko jest zapisywane na bieżąco. Możesz wyjść i wrócić w dowolnej chwili.
        </p>
        {hasProfil && <SkipOnboardingButton />}
      </div>
    </div>
  )
}

function Step({
  number,
  title,
  subtitle,
  time,
  status,
  href,
  ctaLabel,
  disabledHint,
}: {
  number: number
  title: string
  subtitle: string
  time: string
  status: 'pending' | 'progress' | 'done' | 'locked'
  href: string
  ctaLabel: string
  disabledHint?: string
}) {
  const isLocked = status === 'locked'
  const isDone = status === 'done'

  const content = (
    <div
      className={
        'group flex items-center justify-between p-5 rounded-xl border transition-all duration-200 ' +
        (isLocked
          ? 'bg-foreground/[0.01] border-foreground/[0.05] opacity-50'
          : isDone
          ? 'bg-emerald-500/[0.04] border-emerald-500/20 hover:border-emerald-500/40'
          : 'bg-foreground/[0.02] border-foreground/[0.08] hover:border-accent/40 hover:bg-foreground/[0.04]')
      }
    >
      <div className="flex items-center gap-5 min-w-0">
        <div
          className={
            'shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ' +
            (isDone
              ? 'bg-emerald-500/20 text-emerald-400'
              : status === 'progress'
              ? 'bg-accent/20 text-accent'
              : 'bg-foreground/[0.05] text-foreground/40')
          }
        >
          {isDone ? '✓' : number}
        </div>
        <div className="min-w-0">
          <div className="text-foreground text-[15px] font-medium truncate">{title}</div>
          <div className="text-foreground/40 text-xs mt-0.5 flex items-center gap-2">
            <span>{subtitle}</span>
            <span className="text-foreground/20">·</span>
            <span>{time}</span>
          </div>
        </div>
      </div>
      <div className="shrink-0 ml-4">
        {disabledHint ? (
          <span className="text-foreground/25 text-[11px] uppercase tracking-[0.2em]">
            {disabledHint}
          </span>
        ) : (
          <span
            className={
              'text-[11px] uppercase tracking-[0.25em] transition-colors ' +
              (isDone
                ? 'text-emerald-400'
                : 'text-foreground/50 group-hover:text-accent')
            }
          >
            {ctaLabel} →
          </span>
        )}
      </div>
    </div>
  )

  if (isLocked) return content
  return (
    <Link href={href} className="block">
      {content}
    </Link>
  )
}
