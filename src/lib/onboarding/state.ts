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
