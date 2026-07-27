import { redirect, notFound } from 'next/navigation'
import { getOnboardingState, getProfilMd } from '@/lib/onboarding/state'
import { getPersonaQuestions } from '@/data/onboarding/persona-questions'
import PersonaFlow from '@/components/onboarding/PersonaFlow'

export const dynamic = 'force-dynamic'

export default async function PersonaPage({
  params,
}: {
  params: Promise<{ type: string }>
}) {
  const { type: t } = await params
  if (t !== 'buyer' && t !== 'seller') notFound()
  const type = t as 'buyer' | 'seller'

  const profilMd = await getProfilMd()
  if (!profilMd) {
    redirect('/onboarding/express')
  }

  const state = await getOnboardingState()
  const slot = type === 'buyer' ? state.personaBuyer : state.personaSeller
  const questions = getPersonaQuestions(type)

  return (
    <PersonaFlow
      type={type}
      initialPath={slot.path}
      questions={questions}
      initialAnswers={slot.answers}
      resultPath={`/onboarding/persona/${type}/result`}
    />
  )
}
