import { NextResponse } from 'next/server'
import { savePersonaAnswer } from '@/lib/onboarding/state'

export async function POST(req: Request) {
  const { type, questionId, answer } = await req.json()
  if (
    (type !== 'buyer' && type !== 'seller') ||
    typeof questionId !== 'string' ||
    typeof answer !== 'string'
  ) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  await savePersonaAnswer(type, questionId, answer)
  return NextResponse.json({ ok: true })
}
