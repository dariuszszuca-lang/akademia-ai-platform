import Link from 'next/link'
import { getOnboardingState, getProfilMd } from '@/lib/onboarding/state'
import { expressQuestions } from '@/data/onboarding/express'

export const dynamic = 'force-dynamic'

export default async function OnboardingWelcome() {
  const state = await getOnboardingState()
  const hasProfil = Boolean(await getProfilMd())

  const expressDone = expressQuestions.every(q => state.expressAnswers[q.id]?.trim())
  const expressInProgress = !expressDone && Object.keys(state.expressAnswers).length > 0

  return (
    <div className="max-w-2xl mx-auto py-16 sm:py-24 space-y-12 animate-fade-in-up">
      <div className="space-y-6">
        <div className="text-[11px] uppercase tracking-[0.3em] text-amber-400/80">
          Onboarding
        </div>
        <h1 className="text-foreground text-4xl sm:text-5xl font-medium leading-tight tracking-tight">
          Stworzmy razem Twoj profil.
        </h1>
        <p className="text-foreground/55 text-lg leading-relaxed max-w-xl">
          AI pozna Cie w 20 minut. Kazdy kolejny agent na platformie (CEO, Marketing,
          Prawny, Wycena, Publikacja) bedzie odpowiadal w Twoich realiach. Bez generycznych
          rad. Konkretnie pod Twoj rynek, klienta, cele.
        </p>
      </div>

      <div className="space-y-3 stagger-children">
        <Step
          number={1}
          title="Profil agenta"
          subtitle="15 pytan w 3 czesciach"
          time="~20 min"
          status={expressDone ? 'done' : expressInProgress ? 'progress' : 'pending'}
          href="/onboarding/express"
          ctaLabel={expressDone ? 'Zobacz profil' : expressInProgress ? 'Kontynuuj' : 'Zacznij'}
        />
        <Step
          number={2}
          title="Persona klienta kupujacego"
          subtitle="Chat z AI, sciezka A lub B"
          time="~10 min"
          status={hasProfil ? 'pending' : 'locked'}
          href="/onboarding/persona/buyer"
          ctaLabel="Zacznij"
          disabledHint={hasProfil ? undefined : 'Wymaga profilu'}
        />
        <Step
          number={3}
          title="Persona klienta sprzedajacego"
          subtitle="Chat z AI, sciezka A lub B"
          time="~10 min"
          status="locked"
          href="/onboarding/persona/seller"
          ctaLabel="Zacznij"
          disabledHint="Najpierw kupujacy"
        />
        <Step
          number={4}
          title="Profil poglebiony (opcja)"
          subtitle="20 pytan, dodatkowe sekcje"
          time="~30 min"
          status="locked"
          href="/onboarding/deep"
          ctaLabel="Zacznij"
          disabledHint="Po podstawowym onboardingu"
        />
      </div>

      <div className="pt-4 border-t border-foreground/[0.06] text-foreground/30 text-xs leading-relaxed">
        Wszystko jest zapisywane na biezaco. Mozesz wyjsc i wrocic w dowolnej chwili.
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
          : 'bg-foreground/[0.02] border-foreground/[0.08] hover:border-amber-400/40 hover:bg-foreground/[0.04]')
      }
    >
      <div className="flex items-center gap-5 min-w-0">
        <div
          className={
            'shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ' +
            (isDone
              ? 'bg-emerald-500/20 text-emerald-400'
              : status === 'progress'
              ? 'bg-amber-400/20 text-amber-400'
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
                : 'text-foreground/50 group-hover:text-amber-400')
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
