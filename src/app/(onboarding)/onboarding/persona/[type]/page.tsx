import { redirect, notFound } from 'next/navigation'
import { getOnboardingState, getProfilMd } from '@/lib/onboarding/state'
import { getPersonaQuestions } from '@/data/onboarding/persona-questions'
import PersonaChat from '@/components/onboarding/PersonaChat'

export const dynamic = 'force-dynamic'

export default async function PersonaChatPage({
  params,
}: {
  params: { type: string }
}) {
  const t = params.type
  if (t !== 'buyer' && t !== 'seller') notFound()
  const type = t as 'buyer' | 'seller'

  // Wymagamy profil.md przed rozpoczeciem persony
  const profilMd = await getProfilMd()
  if (!profilMd) {
    redirect('/onboarding/express')
  }

  const state = await getOnboardingState()
  const slot = type === 'buyer' ? state.personaBuyer : state.personaSeller
  const questions = getPersonaQuestions(type)

  return (
    <PersonaChat
      type={type}
      questions={questions}
      initialAnswers={slot.answers}
      resultPath={`/onboarding/persona/${type}/result`}
    />
  )
}
