import { NextResponse } from 'next/server'
import { getOnboardingState, getProfilMd } from '@/lib/onboarding/state'
import { resolveApiUser } from '@/lib/request-auth'

export async function GET() {
  const auth = await resolveApiUser()
  if (!auth.ok) return auth.response

  const state = await getOnboardingState()
  const profilMd = await getProfilMd()
  return NextResponse.json({ state, hasProfilMd: Boolean(profilMd) })
}
