import { NextResponse } from 'next/server'
import { deleteAccountData } from '@/features/properties/account-data'
import { getPropertyRepository } from '@/features/properties/server-repository'
import { getServerUserId, SESSION_COOKIE } from '@/lib/session'
import { storeDelete } from '@/lib/store'

/**
 * POST /api/account/delete
 * GDPR / RODO Article 17 - Right to erasure ("right to be forgotten").
 *
 * Usuwa wszystkie dane usera z KV (profil, persony, onboarding, subscription).
 * Subskrypcja Stripe NIE jest automatycznie anulowana (musi zrobić to user przez portal Stripe).
 *
 * Body: { confirm: 'DELETE' } - prosty antyprzypadkowy guard
 */
export async function POST(req: Request) {
  const userId = await getServerUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { confirm } = await req.json().catch(() => ({}))
  if (confirm !== 'DELETE') {
    return NextResponse.json(
      { error: 'Wymagane: { confirm: "DELETE" } w body żeby uniknąć przypadkowego usunięcia.' },
      { status: 400 },
    )
  }

  let keys: string[]
  try {
    keys = await deleteAccountData(userId, {
      deletePropertiesForUser: (accountUserId) =>
        getPropertyRepository().deleteForUser(accountUserId),
      deleteValue: storeDelete,
    })
  } catch (error) {
    console.error('[account-delete] deletion_failed', {
      type: error instanceof Error ? error.name : 'unknown',
    })
    return NextResponse.json({ error: 'deletion_failed' }, { status: 500 })
  }

  // Czyść cookie session
  const res = NextResponse.json({
    ok: true,
    deleted: {
      propertyStudio: true,
      accountKeys: keys.length,
    },
  })
  res.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return res
}
