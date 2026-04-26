import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getProfilMd } from '@/lib/onboarding/state'

export const dynamic = 'force-dynamic'

export default async function DeepResultPage() {
  const profilMd = await getProfilMd()

  if (!profilMd) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-4 animate-fade-in-up">
        <div className="text-foreground/50">Profil jeszcze nie wygenerowany.</div>
        <Link
          href="/onboarding/deep"
          className="inline-block text-accent hover:text-accent/80 text-sm uppercase tracking-[0.25em]"
        >
          Wróć do ankiety →
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-12 sm:py-16 space-y-10 animate-fade-in-up">
      <div className="text-center space-y-3">
        <div className="text-[11px] uppercase tracking-[0.3em] text-emerald-400">
          Profil pogłębiony gotowy
        </div>
        <h1 className="text-foreground text-3xl sm:text-4xl font-medium tracking-tight">
          Twój pełny profil agenta.
        </h1>
        <p className="text-foreground/40 text-sm max-w-lg mx-auto">
          AI ma teraz wszystko: kim jesteś, jak pracujesz, gdzie idziesz, jaki Twój rynek i wartości.
        </p>
      </div>

      <div
        className="bg-[#fafaf7] text-[#0a0a0b] rounded-2xl p-10 sm:p-14 shadow-[0_20px_80px_rgba(0,0,0,0.5)] relative"
        style={{ fontFeatureSettings: '"liga" 1, "ss01" 1' }}
      >
        <div className="absolute top-6 right-6 text-[10px] uppercase tracking-[0.3em] text-black/30">
          profil.md (pełny) · {new Date().toLocaleDateString('pl-PL')}
        </div>
        <article
          className="prose prose-sm sm:prose-base max-w-none
            prose-headings:font-medium prose-headings:tracking-tight
            prose-h1:text-2xl prose-h1:mb-6 prose-h1:mt-0
            prose-h2:text-base prose-h2:uppercase prose-h2:tracking-[0.15em] prose-h2:text-black/60 prose-h2:mt-8 prose-h2:mb-3
            prose-ul:my-2 prose-li:my-0
            prose-strong:text-black"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{profilMd}</ReactMarkdown>
        </article>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-foreground/[0.06]">
        <Link
          href="/onboarding/deep"
          className="text-foreground/40 hover:text-foreground text-xs uppercase tracking-[0.25em] transition-colors"
        >
          ← Edytuj odpowiedzi
        </Link>
        <Link
          href="/start"
          className="px-6 py-2.5 bg-accent text-white font-medium rounded-full text-sm hover:bg-accent/90 transition-colors"
        >
          Wejdź do platformy →
        </Link>
      </div>
    </div>
  )
}
