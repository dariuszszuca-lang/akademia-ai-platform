import { NextResponse } from 'next/server'
import { deleteAuthenticatedAccount } from '@/features/account/deletion-workflow'
import { deleteAccountData } from '@/features/properties/account-data'
import { getPropertyRepository } from '@/features/properties/server-repository'
import {
  getPropertySourceObjectPurger,
  getPropertySourceRepository,
} from '@/features/property-sources/server-repository'
import { getStudioEventService } from '@/features/studio-events/server-repository'
import { deleteUser } from '@/lib/cognito'
import { verifyCognitoAccessToken } from '@/lib/cognito-token'
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

  const accessToken = readBearerToken(req.headers.get('authorization'))
  if (!accessToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { confirm } = await req.json().catch(() => ({}))
  if (confirm !== 'DELETE') {
    return NextResponse.json(
      { error: 'Wymagane: { confirm: "DELETE" } w body żeby uniknąć przypadkowego usunięcia.' },
      { status: 400 },
    )
  }

  let deleted
  try {
    deleted = await deleteAuthenticatedAccount({
      sessionUserId: userId,
      accessToken,
      verifyToken: async (token) => {
        try {
          return await verifyCognitoAccessToken(token)
        } catch {
          throw new Error('ACCOUNT_DELETE_INVALID_TOKEN')
        }
      },
      deleteApplicationData: () =>
        deleteAccountData(userId, {
          listSourcesForUser: (accountUserId) =>
            getPropertySourceRepository().listSourcesForUser(
              accountUserId,
            ),
          recordAccountDeleted: async (accountUserId) => {
            const organizationId =
              await getPropertyRepository().getOrCreatePersonalOrganization(
                accountUserId,
              )
            await getStudioEventService().record({
              organizationId,
              userId: accountUserId,
              name: 'account.deleted',
              contractVersion: 'studio-events-v1',
              metadata: {},
            })
          },
          purgeSourceObjects: (sources) =>
            getPropertySourceObjectPurger().purgeSources(sources),
          deletePropertiesForUser: (accountUserId) =>
            getPropertyRepository().deleteForUser(accountUserId),
          deleteValue: storeDelete,
        }),
      deleteIdentity: async (token) => {
        await deleteUser(token)
      },
    })
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'ACCOUNT_DELETE_INVALID_TOKEN'
    ) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 },
      )
    }
    if (
      error instanceof Error &&
      error.message === 'ACCOUNT_DELETE_SUBJECT_MISMATCH'
    ) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    console.error('[account-delete] deletion_failed', {
      type: error instanceof Error ? error.name : 'unknown',
    })
    return NextResponse.json({ error: 'deletion_failed' }, { status: 500 })
  }

  // Czyść cookie session
  const res = NextResponse.json({
    ok: true,
    deleted,
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

function readBearerToken(authorization: string | null) {
  const match = authorization?.match(/^Bearer ([^\s]+)$/)
  return match?.[1] ?? null
}
