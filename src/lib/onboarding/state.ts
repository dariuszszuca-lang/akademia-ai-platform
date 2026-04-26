import { storeGet, storeSet } from '@/lib/store'
import { emptyState, type OnboardingState } from './types'

const DEMO_USER_ID = 'demo-user'

function getUserId(): string {
  // MVP: statyczny user. Pozniej z Cognito / NextAuth.
  return DEMO_USER_ID
}

function stateKey(userId: string): string {
  return `user:${userId}:onboarding`
}

function profilKey(userId: string): string {
  return `user:${userId}:profil`
}

function personaBuyerKey(userId: string): string {
  return `user:${userId}:persona-buyer`
}

function personaSellerKey(userId: string): string {
  return `user:${userId}:persona-seller`
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const userId = getUserId()
  const existing = await storeGet<OnboardingState>(stateKey(userId))
  return existing ?? emptyState()
}

export async function saveOnboardingState(state: OnboardingState): Promise<void> {
  const userId = getUserId()
  await storeSet(stateKey(userId), state)
}

export async function saveExpressAnswer(
  questionId: string,
  answer: string,
): Promise<OnboardingState> {
  const state = await getOnboardingState()
  state.expressAnswers[questionId] = answer
  if (state.currentStep === 'welcome') {
    state.currentStep = 'express'
  }
  await saveOnboardingState(state)
  return state
}

export async function saveProfilMd(markdown: string): Promise<void> {
  const userId = getUserId()
  await storeSet(profilKey(userId), markdown)
  const state = await getOnboardingState()
  state.expressGeneratedAt = new Date().toISOString()
  state.currentStep = 'persona-buyer'
  await saveOnboardingState(state)
}

export async function getProfilMd(): Promise<string | null> {
  const userId = getUserId()
  return storeGet<string>(profilKey(userId))
}

export async function getPersonaBuyerMd(): Promise<string | null> {
  const userId = getUserId()
  return storeGet<string>(personaBuyerKey(userId))
}

export async function getPersonaSellerMd(): Promise<string | null> {
  const userId = getUserId()
  return storeGet<string>(personaSellerKey(userId))
}

export async function markOnboardingComplete(): Promise<void> {
  const state = await getOnboardingState()
  state.currentStep = 'complete'
  state.completedAt = new Date().toISOString()
  await saveOnboardingState(state)
}

// --- Persona helpers ---

type PersonaType = 'buyer' | 'seller'

function personaKey(userId: string, type: PersonaType): string {
  return type === 'buyer' ? personaBuyerKey(userId) : personaSellerKey(userId)
}

export async function setPersonaPath(type: PersonaType, path: 'A' | 'B'): Promise<void> {
  const state = await getOnboardingState()
  const slot = type === 'buyer' ? state.personaBuyer : state.personaSeller
  slot.path = path
  await saveOnboardingState(state)
}

export async function setPersonaChosenType(type: PersonaType, n: 1 | 2 | 3): Promise<void> {
  const state = await getOnboardingState()
  const slot = type === 'buyer' ? state.personaBuyer : state.personaSeller
  slot.chosenType = n
  await saveOnboardingState(state)
}

export async function savePersonaAnswer(
  type: PersonaType,
  questionId: string,
  answer: string,
): Promise<void> {
  const state = await getOnboardingState()
  const slot = type === 'buyer' ? state.personaBuyer : state.personaSeller
  slot.path = 'B' // Path B Pat na razie jedyna
  slot.answers[questionId] = answer
  if (state.currentStep === 'persona-buyer' && type === 'buyer') {
    // pozostaw
  } else if (state.expressGeneratedAt && state.currentStep !== 'persona-seller' && type === 'buyer') {
    state.currentStep = 'persona-buyer'
  }
  await saveOnboardingState(state)
}

export async function saveDeepAnswer(questionId: string, answer: string): Promise<void> {
  const state = await getOnboardingState()
  state.deepAnswers[questionId] = answer
  if (state.currentStep !== 'deep') state.currentStep = 'deep'
  await saveOnboardingState(state)
}

export async function saveExtendedProfilMd(markdown: string): Promise<void> {
  const userId = getUserId()
  await storeSet(profilKey(userId), markdown)
  const state = await getOnboardingState()
  state.deepGeneratedAt = new Date().toISOString()
  state.currentStep = 'complete'
  state.completedAt = new Date().toISOString()
  await saveOnboardingState(state)
}

export async function savePersonaMd(type: PersonaType, markdown: string): Promise<void> {
  const userId = getUserId()
  await storeSet(personaKey(userId, type), markdown)
  const state = await getOnboardingState()
  const slot = type === 'buyer' ? state.personaBuyer : state.personaSeller
  slot.generatedAt = new Date().toISOString()
  if (type === 'buyer') {
    state.currentStep = 'persona-seller'
  } else {
    // Po sprzedajacym idziemy do deep (opcjonalne) lub complete
    state.currentStep = 'deep'
  }
  await saveOnboardingState(state)
}
