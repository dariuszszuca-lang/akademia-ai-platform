import { redirect } from 'next/navigation'
import { deepQuestions } from '@/data/onboarding/deep'
import { getOnboardingState, getProfilMd } from '@/lib/onboarding/state'
import WizardFlow from '@/components/onboarding/WizardFlow'

export const dynamic = 'force-dynamic'

export default async function DeepWizardPage() {
  // Wymagany istniejacy profil.md
  const profilMd = await getProfilMd()
  if (!profilMd) {
    redirect('/onboarding/express')
  }

  const state = await getOnboardingState()

  return (
    <div className="pb-24">
      <WizardFlow
        questions={deepQuestions}
        initialAnswers={state.deepAnswers}
        saveEndpoint="/api/onboarding/save-deep-answer"
        generateEndpoint="/api/onboarding/generate-deep"
        resultPath="/onboarding/deep/result"
      />
    </div>
  )
}
