import { NextResponse } from 'next/server'
import { setPersonaPath } from '@/lib/onboarding/state'

export async function POST(req: Request) {
  const { type, path } = await req.json()
  if ((type !== 'buyer' && type !== 'seller') || (path !== 'A' && path !== 'B')) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  await setPersonaPath(type, path)
  return NextResponse.json({ ok: true })
}
