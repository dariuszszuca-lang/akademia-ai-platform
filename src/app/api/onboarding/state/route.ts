import { NextResponse } from 'next/server'
import { getOnboardingState, getProfilMd } from '@/lib/onboarding/state'

export async function GET() {
  const state = await getOnboardingState()
  const profilMd = await getProfilMd()
  return NextResponse.json({ state, hasProfilMd: Boolean(profilMd) })
}
