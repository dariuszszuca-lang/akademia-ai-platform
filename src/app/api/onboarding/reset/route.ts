import { NextResponse } from 'next/server'
import { storeDelete } from '@/lib/store'

const DEMO_USER = 'demo-user'

/**
 * Admin endpoint do resetu calego onboardingu (do testow).
 * Wymaga ADMIN_PASSWORD w nagłowku.
 *
 * curl -X POST .../api/onboarding/reset -H "Authorization: Bearer $ADMIN_PASSWORD"
 */
export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD not configured' }, { status: 500 })
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const keys = [
    `user:${DEMO_USER}:onboarding`,
    `user:${DEMO_USER}:profil`,
    `user:${DEMO_USER}:persona-buyer`,
    `user:${DEMO_USER}:persona-seller`,
  ]
  for (const k of keys) {
    await storeDelete(k)
  }

  return NextResponse.json({ ok: true, cleared: keys })
}
