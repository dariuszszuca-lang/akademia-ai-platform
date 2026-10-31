import { NextResponse } from 'next/server'
import { getToolResultService } from '@/features/tool-results/server'
import { ToolResultError } from '@/features/tool-results/service'
import { getServerUserId } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function errorResponse(error: unknown) {
  if (error instanceof ToolResultError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === 'not_found' ? 404 : 400 },
    )
  }
  return NextResponse.json({ error: 'Nie udało się zapisać.' }, { status: 500 })
}

export async function GET(request: Request) {
  const userId = await getServerUserId()
  if (!userId) return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 })
  const propertyId = new URL(request.url).searchParams.get('propertyId') ?? ''
  try {
    const results = await getToolResultService().list(userId, propertyId)
    return NextResponse.json({ results })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  const userId = await getServerUserId()
  if (!userId) return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Niepoprawne dane.' }, { status: 400 })
  }
  try {
    const result = await getToolResultService().save(userId, body)
    return NextResponse.json({ result }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
