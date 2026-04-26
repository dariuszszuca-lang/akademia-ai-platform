export type OnboardingStep =
  | 'welcome'
  | 'express'
  | 'persona-buyer'
  | 'persona-seller'
  | 'deep'
  | 'complete'

export type ExpressAnswers = Record<string, string>
export type DeepAnswers = Record<string, string>

export type PersonaPath = 'A' | 'B' | null

export type PersonaState = {
  path: PersonaPath
  answers: Record<string, string>
  chosenType?: 1 | 2 | 3
  generatedAt?: string
}

export type OnboardingState = {
  currentStep: OnboardingStep
  expressAnswers: ExpressAnswers
  personaBuyer: PersonaState
  personaSeller: PersonaState
  deepAnswers: DeepAnswers
  startedAt: string
  completedAt: string | null
  expressGeneratedAt?: string
  deepGeneratedAt?: string
}

export const EMPTY_PERSONA_STATE: PersonaState = {
  path: null,
  answers: {},
}

export function emptyState(): OnboardingState {
  return {
    currentStep: 'welcome',
    expressAnswers: {},
    personaBuyer: { ...EMPTY_PERSONA_STATE },
    personaSeller: { ...EMPTY_PERSONA_STATE },
    deepAnswers: {},
    startedAt: new Date().toISOString(),
    completedAt: null,
  }
}

export type OnboardingQuestion = {
  id: string
  section: string
  sectionLabel: string
  prompt: string
  helper?: string
  type: 'text' | 'textarea' | 'select'
  placeholder?: string
  options?: { value: string; label: string }[]
  estimatedSeconds?: number
}
