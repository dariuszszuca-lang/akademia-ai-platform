import { createHash } from 'node:crypto'

export type WizardResumeDriver = {
  reload(): Promise<void>
  assertNextQuestion(): Promise<void>
  goBack(): Promise<void>
  assertSavedQuestion(): Promise<void>
  readSavedAnswer(): Promise<string>
  goForwardAndAwaitSave(): Promise<void>
}

export type OnboardingArtifactSummary = {
  profilePresent: boolean
  buyerPersonaPresent: boolean
  sellerPersonaPresent: boolean
  personasPresent: boolean
  onboardingPresent: boolean
  digest: string
}

export async function verifyWizardResume(
  driver: WizardResumeDriver,
  expectedAnswer: string,
): Promise<void> {
  await driver.reload()
  await driver.assertNextQuestion()
  await driver.goBack()
  await driver.assertSavedQuestion()
  if ((await driver.readSavedAnswer()) !== expectedAnswer) {
    throw new Error('ONBOARDING_RESUME_ANSWER_MISMATCH')
  }
  await driver.goForwardAndAwaitSave()
  await driver.assertNextQuestion()
}

export function summarizeOnboardingArtifacts(
  payload: unknown,
): OnboardingArtifactSummary {
  const root = isRecord(payload) ? payload : {}
  const selected = {
    profil: root.profil ?? null,
    personaBuyer: root.personaBuyer ?? null,
    personaSeller: root.personaSeller ?? null,
    onboarding: root.onboarding ?? null,
  }

  const buyerPersonaPresent = isNonEmptyData(
    selected.personaBuyer,
  )
  const sellerPersonaPresent = isNonEmptyData(
    selected.personaSeller,
  )
  return {
    profilePresent: isNonEmptyData(selected.profil),
    buyerPersonaPresent,
    sellerPersonaPresent,
    personasPresent:
      buyerPersonaPresent && sellerPersonaPresent,
    onboardingPresent: isNonEmptyData(selected.onboarding),
    digest: createHash('sha256')
      .update(canonicalJson(selected))
      .digest('hex'),
  }
}

export function assertOnboardingResetEvidence(input: {
  beforeA: OnboardingArtifactSummary
  beforeB: OnboardingArtifactSummary
  afterA: OnboardingArtifactSummary
  afterB: OnboardingArtifactSummary
}): void {
  if (!hasCompleteArtifacts(input.beforeA)) {
    throw new Error('ONBOARDING_RESET_A_BASELINE_MISSING')
  }
  if (!hasCompleteArtifacts(input.beforeB)) {
    throw new Error('ONBOARDING_RESET_B_BASELINE_MISSING')
  }
  if (
    input.afterA.profilePresent ||
    input.afterA.buyerPersonaPresent ||
    input.afterA.sellerPersonaPresent ||
    input.afterA.onboardingPresent
  ) {
    throw new Error('ONBOARDING_RESET_A_NOT_CLEARED')
  }
  if (
    !hasCompleteArtifacts(input.afterB) ||
    input.afterB.digest !== input.beforeB.digest
  ) {
    throw new Error('ONBOARDING_RESET_B_CHANGED')
  }
}

function hasCompleteArtifacts(
  value: OnboardingArtifactSummary,
): boolean {
  return (
    value.profilePresent &&
    value.personasPresent &&
    value.onboardingPresent
  )
}

function isNonEmptyData(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return isRecord(value) && Object.keys(value).length > 0
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
      )
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}
