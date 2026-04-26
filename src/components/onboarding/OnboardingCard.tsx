import Link from 'next/link'
import { getOnboardingState, getProfilMd, getPersonaBuyerMd, getPersonaSellerMd } from '@/lib/onboarding/state'
import { expressQuestions } from '@/data/onboarding/express'

/**
 * Card pokazywany na stronie glownej dashboardu (`/start`).
 * Pokazuje stan onboardingu (Profil + Persona Buyer + Persona Seller) i CTA do dokonczenia.
 */
export default async function OnboardingCard() {
  const state = await getOnboardingState()
  const [profil, personaBuyer, personaSeller] = await Promise.all([
    getProfilMd(),
    getPersonaBuyerMd(),
    getPersonaSellerMd(),
  ])

  const profilDone = Boolean(profil)
  const buyerDone = Boolean(personaBuyer)
  const sellerDone = Boolean(personaSeller)
  const allDone = profilDone && buyerDone && sellerDone

  // Express w trakcie?
  const expressTotal = expressQuestions.length
  const expressFilled = expressQuestions.filter(q => state.expressAnswers[q.id]?.trim()).length
  const expressInProgress = !profilDone && expressFilled > 0
  const expressPct = Math.round((expressFilled / expressTotal) * 100)

  // Jesli wszystko gotowe i nie chcemy zaslaniac dashboardu, zwroc null
  if (allDone) return null

  // Stan: nic nie zaczete, w trakcie Express, lub po Express bez person
  let title = 'Stwórz swój profil AI'
  let subtitle = 'Każdy agent na platformie odpowiada konkretnie pod Twój rynek, klienta i cele. To zajmie 20 minut.'
  let cta = 'Zacznij ankietę →'
  let progress: { label: string; pct: number } | null = null

  if (expressInProgress) {
    title = 'Dokończ profil agenta'
    subtitle = `Masz wypełnionych ${expressFilled} z ${expressTotal} pytań. Wracaj kiedy chcesz, wszystko zapisane.`
    cta = 'Wróć do ankiety →'
    progress = { label: `${expressFilled} / ${expressTotal} pytań`, pct: expressPct }
  } else if (profilDone && (!buyerDone || !sellerDone)) {
    title = 'Profil gotowy. Czas na persony klientów.'
    subtitle = 'Każda persona to osobny chat z AI (~10 min). Dzięki temu Marketing i Wycena agent znają Twojego klienta dokładnie.'
    cta = buyerDone ? 'Persona sprzedającego →' : 'Persona kupującego →'
  }

  return (
    <Link
      href="/onboarding"
      className="group block rounded-[2rem] border border-accent/30 bg-[color:var(--card)] p-8 transition hover:border-accent/60 sm:p-10 relative overflow-hidden"
    >
      {/* Subtelny accent glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            'radial-gradient(circle at 100% 0%, var(--accent-light), transparent 50%)',
        }}
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent">
            Pierwszy krok
          </p>
          <h2 className="mt-3 font-display text-3xl text-foreground">
            {title}
          </h2>
          <p className="mt-3 text-sm text-foreground/55 leading-relaxed">
            {subtitle}
          </p>

          {progress && (
            <div className="mt-5">
              <div className="flex justify-between text-[11px] uppercase tracking-[0.25em] text-foreground/40 mb-2">
                <span>Postęp</span>
                <span>{progress.label}</span>
              </div>
              <div className="h-px bg-foreground/10 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-accent transition-all duration-500"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Status pills */}
          <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
            <StatusPill done={profilDone} label="Profil agenta" />
            <StatusPill done={buyerDone} label="Persona kupującego" locked={!profilDone} />
            <StatusPill done={sellerDone} label="Persona sprzedającego" locked={!buyerDone} />
          </div>
        </div>

        <div className="shrink-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition group-hover:opacity-90">
            {cta}
          </span>
        </div>
      </div>
    </Link>
  )
}

function StatusPill({ done, locked, label }: { done: boolean; locked?: boolean; label: string }) {
  let cls = 'bg-foreground/[0.04] text-foreground/40 border-foreground/[0.08]'
  let prefix = '○'
  if (done) {
    cls = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
    prefix = '✓'
  } else if (locked) {
    cls = 'bg-foreground/[0.02] text-foreground/25 border-foreground/[0.06]'
    prefix = '·'
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${cls}`}>
      <span className="font-mono">{prefix}</span>
      {label}
    </span>
  )
}
