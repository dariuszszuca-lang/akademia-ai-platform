import { NextResponse } from 'next/server'
import { anthropic, DEFAULT_MODEL } from '@/lib/anthropic'
import { buildProposeTypesPrompt } from '@/lib/onboarding/persona-prompts'
import { getProfilMd } from '@/lib/onboarding/state'
import { getEffectivePlan } from '@/lib/billing/state'
import { PLAN_FEATURES } from '@/lib/billing/plans'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: Request) {
  const { type } = await req.json()
  if (type !== 'buyer' && type !== 'seller') {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 })
  }

  const profilMd = await getProfilMd()
  if (!profilMd) {
    return NextResponse.json({ error: 'profil not generated yet' }, { status: 400 })
  }

  // Gate: Path A wymaga Pro+
  const { plan, active } = await getEffectivePlan()
  const features = plan === 'expired' ? PLAN_FEATURES.starter : PLAN_FEATURES[plan]
  if (!active || !features.pathA) {
    return NextResponse.json(
      { error: 'Persona Path A jest dostępna w planie Pro+. Możesz użyć Path B (chat z 6 pytaniami) lub upgrade w /pricing.' },
      { status: 402 },
    )
  }

  const { system, user } = buildProposeTypesPrompt(type, profilMd)

  try {
    const msg = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: 'user', content: user }],
    })

    const text =
      msg.content
        .map(b => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim()

    // Wyciagnij JSON (czasami AI dorzuci coś przed/po)
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1) {
      return NextResponse.json({ error: 'invalid AI response', raw: text }, { status: 500 })
    }
    const json = JSON.parse(text.slice(start, end + 1))
    return NextResponse.json(json)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    )
  }
}
