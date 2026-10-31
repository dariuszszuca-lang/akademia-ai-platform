import { NextResponse } from 'next/server'
import { runNodeStyleHandler } from '@/features/spacer/adapter'
import handler from '@/features/spacer/rzut.mjs'
import { getServerUserId } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Odczyt rzutu przez AI dla kopii spacera 3D w platformie.
 * W platformie tylko dla zalogowanych (koszt AI liczony na konto platformy).
 * Funkcja AI ma wpis AI-039 i widoczną etykietę „Odczyt rzutu: AI” w spacerze.
 */
export async function POST(request: Request) {
  const userId = await getServerUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Odczyt rzutu działa po zalogowaniu.' }, { status: 401 })
  }
  return runNodeStyleHandler(handler, request)
}

export async function OPTIONS(request: Request) {
  return runNodeStyleHandler(handler, request)
}
