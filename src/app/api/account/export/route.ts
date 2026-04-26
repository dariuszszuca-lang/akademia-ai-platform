import { NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/session'
import { storeGet } from '@/lib/store'

/**
 * GET /api/account/export
 * GDPR / RODO Article 15 - Right of access.
 * Zwraca wszystkie dane usera w formie JSON do pobrania.
 */
export async function GET() {
  const userId = await getServerUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [profil, personaBuyer, personaSeller, onboarding, subscription] = await Promise.all([
    storeGet<string>(`user:${userId}:profil`),
    storeGet<string>(`user:${userId}:persona-buyer`),
    storeGet<string>(`user:${userId}:persona-seller`),
    storeGet<unknown>(`user:${userId}:onboarding`),
    storeGet<unknown>(`user:${userId}:subscription`),
  ])

  const data = {
    exportedAt: new Date().toISOString(),
    userId,
    profil,
    personaBuyer,
    personaSeller,
    onboarding,
    subscription,
    note: 'Eksport zgodny z art. 15 RODO. Zawiera wszystkie dane Twojego konta.',
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="akademia-ai-export-${userId.slice(0, 8)}.json"`,
    },
  })
}
