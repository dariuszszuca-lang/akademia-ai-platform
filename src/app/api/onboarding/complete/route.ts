import { NextResponse } from 'next/server'
import { markOnboardingComplete } from '@/lib/onboarding/state'

export async function POST() {
  await markOnboardingComplete()
  return NextResponse.json({ ok: true })
}
