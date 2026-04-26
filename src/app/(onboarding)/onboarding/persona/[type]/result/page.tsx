import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getPersonaBuyerMd, getPersonaSellerMd, getOnboardingState } from '@/lib/onboarding/state'
import RegenerateButton from '@/components/onboarding/RegenerateButton'

export const dynamic = 'force-dynamic'

export default async function PersonaResultPage({
  params,
}: {
  params: { type: string }
}) {
  const t = params.type
  if (t !== 'buyer' && t !== 'seller') notFound()
  const type = t as 'buyer' | 'seller'
  const isBuyer = type === 'buyer'

  const md = isBuyer ? await getPersonaBuyerMd() : await getPersonaSellerMd()
  const state = await getOnboardingState()
  const slot = isBuyer ? state.personaBuyer : state.personaSeller
  const usedPathA = slot.path === 'A' && slot.chosenType
  const personaTypeForRegen = usedPathA
    ? null // Path A wymaga chosenType - skip regenerate from result page (zbyt skomplikowane)
    : slot.path === 'B'
    ? 'B'
    : null

  if (!md) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-4 animate-fade-in-up">
        <div className="text-foreground/50">Persona jeszcze nie wygenerowana.</div>
        <Link
          href={`/onboarding/persona/${type}`}
          className="inline-block text-accent hover:text-accent/80 text-sm uppercase tracking-[0.25em]"
        >
          Wróć do chatu →
        </Link>
      </div>
    )
  }

  const nextHref = isBuyer ? '/onboarding/persona/seller' : '/onboarding'
  const nextLabel = isBuyer ? 'Dalej: Persona sprzedającego →' : 'Wróć do podsumowania →'

  return (
    <div className="max-w-3xl mx-auto py-12 sm:py-16 space-y-10 animate-fade-in-up">
      <div className="text-center space-y-3">
        <div className="text-[11px] uppercase tracking-[0.3em] text-emerald-400">
          Persona gotowa
        </div>
        <h1 className="text-foreground text-3xl sm:text-4xl font-medium tracking-tight">
          {isBuyer ? 'Twój klient kupujący.' : 'Twój klient sprzedający.'}
        </h1>
        <p className="text-foreground/40 text-sm max-w-lg mx-auto">
          AI używa tego dokumentu w każdej odpowiedzi Marketing/Wycena agenta.
        </p>
      </div>

      <div
        className="bg-[#fafaf7] text-[#0a0a0b] rounded-2xl p-10 sm:p-14 shadow-[0_20px_80px_rgba(0,0,0,0.5)] relative"
        style={{ fontFeatureSettings: '"liga" 1, "ss01" 1' }}
      >
        <div className="absolute top-6 right-6 text-[10px] uppercase tracking-[0.3em] text-black/30">
          persona-{isBuyer ? 'kupujacy' : 'sprzedajacy'}.md · {new Date().toLocaleDateString('pl-PL')}
        </div>
        <article
          className="prose prose-sm sm:prose-base max-w-none
            prose-headings:font-medium prose-headings:tracking-tight
            prose-h1:text-2xl prose-h1:mb-6 prose-h1:mt-0
            prose-h2:text-base prose-h2:uppercase prose-h2:tracking-[0.15em] prose-h2:text-black/60 prose-h2:mt-8 prose-h2:mb-3
            prose-ul:my-2 prose-li:my-0
            prose-strong:text-black
            prose-table:text-sm prose-th:bg-black/[0.04] prose-th:text-left prose-td:py-2"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
        </article>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-foreground/[0.06]">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href={`/onboarding/persona/${type}`}
            className="text-foreground/40 hover:text-foreground text-xs uppercase tracking-[0.25em] transition-colors"
          >
            ← Edytuj odpowiedzi
          </Link>
          {personaTypeForRegen === 'B' && (
            <RegenerateButton
              endpoint="/api/onboarding/persona/generate"
              body={{ type }}
              label="Wygeneruj ponownie"
            />
          )}
        </div>
        <Link
          href={nextHref}
          className="px-6 py-2.5 bg-accent text-white font-medium rounded-full text-sm hover:bg-accent/90 transition-colors"
        >
          {nextLabel}
        </Link>
      </div>
    </div>
  )
}
