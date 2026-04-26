import Link from 'next/link'
import { agents } from '@/data/agents'
import { getOnboardingState } from '@/lib/onboarding/state'

/**
 * Pokazywany zamiast /agent kiedy uzytkownik nie ma profil.md.
 * Agenty bez profilu odpowiadaja generycznie, wiec zmuszamy do onboardingu.
 */
export default async function AgentGate() {
  const state = await getOnboardingState()
  const expressFilled = Object.keys(state.expressAnswers).length
  const expressInProgress = expressFilled > 0
  const expressTotal = 15

  return (
    <div className="mx-auto max-w-3xl space-y-10 animate-fade-in-up">
      <header className="space-y-4">
        <p className="eyebrow">Agenci AI</p>
        <h1 className="display-title text-foreground" style={{ fontSize: 'clamp(36px, 5.5vw, 56px)' }}>
          Najpierw <em>profil</em>, potem agenty.
        </h1>
        <p className="text-foreground/55 text-base leading-relaxed max-w-2xl">
          Każdy agent na platformie odpowiada konkretnie pod Twój rynek, klienta, cele.
          Bez profilu odpowiedzi są generyczne, niewarte Twojego czasu. To zajmuje 20 minut.
        </p>
      </header>

      {/* Premium locked CTA */}
      <Link
        href={expressInProgress ? '/onboarding/express' : '/onboarding'}
        className="group block rounded-[2rem] border border-accent/30 bg-[color:var(--card)] p-8 transition hover:border-accent/60 sm:p-10 relative overflow-hidden"
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            background: 'radial-gradient(circle at 100% 0%, var(--accent-light), transparent 50%)',
          }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent">
              Wymagane przed agentami
            </p>
            <h2 className="mt-3 font-display text-3xl text-foreground">
              {expressInProgress ? 'Dokończ profil agenta' : 'Stwórz swój profil AI'}
            </h2>
            <p className="mt-3 text-sm text-foreground/55 leading-relaxed">
              {expressInProgress
                ? `Masz wypełnionych ${expressFilled} z ${expressTotal} pytań. Wracaj kiedy chcesz, wszystko zapisane.`
                : '15 pytań w 3 częściach, około 20 minut. Po skończeniu wracasz tu i agenty pracują w Twoich realiach.'}
            </p>
          </div>
          <div className="shrink-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition group-hover:opacity-90">
              {expressInProgress ? 'Wróć do ankiety →' : 'Zacznij ankietę →'}
            </span>
          </div>
        </div>
      </Link>

      {/* Preview agentów (zablokowane) */}
      <section>
        <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
          Co Cię czeka po profilu
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {agents.filter(a => a.enabled).map(a => (
            <div
              key={a.id}
              className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-5 opacity-50"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-xl shrink-0"
                  style={{ background: `${a.color}18`, border: `1px solid ${a.color}30` }}
                >
                  {a.icon}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{a.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-foreground/55 line-clamp-2">{a.tagline}</p>
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-foreground/30 shrink-0 mt-1"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
