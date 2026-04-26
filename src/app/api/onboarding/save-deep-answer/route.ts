import { NextResponse } from 'next/server'
import { saveDeepAnswer } from '@/lib/onboarding/state'

export async function POST(req: Request) {
  const { questionId, answer } = await req.json()
  if (typeof questionId !== 'string' || typeof answer !== 'string') {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  await saveDeepAnswer(questionId, answer)
  return NextResponse.json({ ok: true })
}
