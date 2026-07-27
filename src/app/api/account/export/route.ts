import { NextResponse } from 'next/server'
import { exportAccountData } from '@/features/properties/account-data'
import { getPropertyRepository } from '@/features/properties/server-repository'
import { getPropertySourceRepository } from '@/features/property-sources/server-repository'
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

  const accountData = await exportAccountData(userId, {
    getValue: (key) => storeGet(key),
    exportForUser: (accountUserId) =>
      getPropertyRepository().exportForUser(accountUserId),
    exportSourcesForUser: (accountUserId) =>
      getPropertySourceRepository().exportForUser(accountUserId),
  })

  const data = {
    exportedAt: new Date().toISOString(),
    userId,
    ...accountData,
    note: 'Eksport zgodny z art. 15 RODO. Zawiera wszystkie dane Twojego konta.',
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="property-studio-export-${userId.slice(0, 8)}.json"`,
    },
  })
}
