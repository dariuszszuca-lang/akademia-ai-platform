import { NextResponse } from 'next/server'
import { markOnboardingComplete } from '@/lib/onboarding/state'
import { resolveApiUser } from '@/lib/request-auth'

export async function POST() {
  const auth = await resolveApiUser()
  if (!auth.ok) return auth.response

  await markOnboardingComplete()
  return NextResponse.json({ ok: true })
}
