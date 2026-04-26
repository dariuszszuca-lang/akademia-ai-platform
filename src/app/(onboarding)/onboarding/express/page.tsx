import { expressQuestions } from '@/data/onboarding/express'
import { getOnboardingState } from '@/lib/onboarding/state'
import WizardFlow from '@/components/onboarding/WizardFlow'

export const dynamic = 'force-dynamic'

export default async function ExpressWizardPage() {
  const state = await getOnboardingState()

  return (
    <div className="pb-24">
      <WizardFlow
        questions={expressQuestions}
        initialAnswers={state.expressAnswers}
        saveEndpoint="/api/onboarding/save-answer"
        generateEndpoint="/api/onboarding/generate-profil"
        resultPath="/onboarding/express/result"
      />
    </div>
  )
}
