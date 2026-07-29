import { NextResponse } from 'next/server'
import { findAgent } from '@/data/agents'
import { isAuthenticated } from '@/lib/admin-auth'
import {
  getEffectiveAgents,
  kvStatus,
  setAgentOverride,
} from '@/lib/agent-overrides'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    agents: await getEffectiveAgents(),
    kv: kvStatus(),
  })
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { id?: string; enabled?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { id, enabled } = body
  if (!id || typeof enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'Missing id or enabled' },
      { status: 400 },
    )
  }

  if (!findAgent(id)) {
    return NextResponse.json(
      { error: 'Agent not found' },
      { status: 404 },
    )
  }

  try {
    await setAgentOverride(id, { enabled })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
