import { NextResponse } from 'next/server'
import { saveExpressAnswer } from '@/lib/onboarding/state'
import { resolveApiUser } from '@/lib/request-auth'

export async function POST(req: Request) {
  const auth = await resolveApiUser()
  if (!auth.ok) return auth.response

  const { questionId, answer } = await req.json()
  if (typeof questionId !== 'string' || typeof answer !== 'string') {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  const state = await saveExpressAnswer(questionId, answer)
  return NextResponse.json({ ok: true, state })
}
