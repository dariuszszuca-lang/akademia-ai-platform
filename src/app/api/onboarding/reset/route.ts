import { NextResponse } from 'next/server'
import { storeDelete } from '@/lib/store'
import { getServerUserId } from '@/lib/session'

/**
 * Reset onboarding ZALOGOWANEGO usera (lub demo-user gdy brak sesji).
 * Wymaga: ADMIN_PASSWORD w Authorization (defense, zeby nikt nie wyczyscil sobie z poziomu konsoli).
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

  const userId = (await getServerUserId()) ?? 'demo-user'

  const keys = [
    `user:${userId}:onboarding`,
    `user:${userId}:profil`,
    `user:${userId}:persona-buyer`,
    `user:${userId}:persona-seller`,
  ]
  for (const k of keys) {
    await storeDelete(k)
  }

  return NextResponse.json({ ok: true, cleared: keys, userId })
}
