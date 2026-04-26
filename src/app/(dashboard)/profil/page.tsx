import Link from 'next/link'
import {
  getProfilMd,
  getPersonaBuyerMd,
  getPersonaSellerMd,
  getOnboardingState,
} from '@/lib/onboarding/state'
import ProfilFiles from '@/components/onboarding/ProfilFiles'

export const dynamic = 'force-dynamic'

export default async function ProfilPage() {
  const [profil, buyer, seller, state] = await Promise.all([
    getProfilMd(),
    getPersonaBuyerMd(),
    getPersonaSellerMd(),
    getOnboardingState(),
  ])

  return (
    <div className="mx-auto max-w-4xl space-y-10 animate-fade-in-up">
      <header>
        <p className="eyebrow">Twój profil AI</p>
        <h1 className="display-title mt-3 text-4xl text-foreground sm:text-5xl">
          Tak Cię widzą agenty.
        </h1>
        <p className="mt-3 text-base text-foreground/55 leading-relaxed max-w-2xl">
          Każdy plik poniżej trafia jako kontekst do każdego agenta na platformie.
          Jeśli coś nie pasuje, edytuj odpowiedzi w ankiecie albo wygeneruj ponownie.
        </p>
      </header>

      <ProfilFiles
        profil={profil}
        buyer={buyer}
        seller={seller}
        deepGenerated={Boolean(state.deepGeneratedAt)}
      />

      <div className="pt-8 border-t border-foreground/[0.06]">
        <h2 className="text-foreground text-lg font-medium mb-3">Brakuje czegoś?</h2>
        <div className="space-y-2 text-sm">
          {!profil && (
            <Link
              href="/onboarding/express"
              className="block p-4 rounded-xl border border-accent/30 bg-accent/[0.06] hover:border-accent/50 transition-colors"
            >
              <span className="text-accent font-medium">Zacznij od profilu agenta →</span>
              <p className="text-foreground/50 text-xs mt-1">15 pytań w 3 częściach, ~20 min</p>
            </Link>
          )}
          {profil && !buyer && (
            <Link
              href="/onboarding/persona/buyer"
              className="block p-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] hover:border-accent/40 transition-colors"
            >
              <span className="text-foreground font-medium">Dodaj personę kupującego →</span>
              <p className="text-foreground/50 text-xs mt-1">
                Bez tego Marketing agent nie wie kto jest Twoim klientem
              </p>
            </Link>
          )}
          {profil && buyer && !seller && (
            <Link
              href="/onboarding/persona/seller"
              className="block p-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] hover:border-accent/40 transition-colors"
            >
              <span className="text-foreground font-medium">Dodaj personę sprzedającego →</span>
              <p className="text-foreground/50 text-xs mt-1">Domyka obraz Twojego klienta</p>
            </Link>
          )}
          {profil && buyer && seller && !state.deepGeneratedAt && (
            <Link
              href="/onboarding/deep"
              className="block p-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] hover:border-accent/40 transition-colors"
            >
              <span className="text-foreground font-medium">Profil pogłębiony (opcja) →</span>
              <p className="text-foreground/50 text-xs mt-1">
                20 dodatkowych pytań, dokłada doświadczenie / rynek / wartości
              </p>
            </Link>
          )}
          {profil && buyer && seller && state.deepGeneratedAt && (
            <p className="text-foreground/50 text-sm">
              Wszystkie pliki gotowe. Możesz w każdej chwili regenerować po zmianie odpowiedzi.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
