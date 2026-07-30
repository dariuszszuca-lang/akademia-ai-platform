import { NextResponse } from 'next/server'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { anthropic, DEFAULT_MODEL } from '@/lib/anthropic'
import { buildProposeTypesPrompt } from '@/lib/onboarding/persona-prompts'
import { getProfilMd } from '@/lib/onboarding/state'
import { getEffectivePlan } from '@/lib/billing/state'
import { PLAN_FEATURES } from '@/lib/billing/plans'
import { resolveApiUser } from '@/lib/request-auth'
import { observableModelHeaders } from '@/lib/model-id'

export const runtime = 'nodejs'
export const maxDuration = 30

const personaTypeSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    who: z.string().trim().min(1).max(500),
    problem: z.string().trim().min(1).max(500),
    match: z.string().trim().min(1).max(500),
  })
  .strict()

const personaTypesSchema = z
  .object({
    types: z.array(personaTypeSchema).length(3),
  })
  .strict()

export async function POST(req: Request) {
  const auth = await resolveApiUser()
  if (!auth.ok) return auth.response

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
    const msg = await anthropic.messages.create(
      {
        model: DEFAULT_MODEL,
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: {
          format: zodOutputFormat(personaTypesSchema),
        },
      },
      {
        timeout: 25_000,
        maxRetries: 0,
      },
    )

    const text =
      msg.content
        .map(b => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { error: 'invalid AI response' },
        { status: 502 },
      )
    }

    const result = personaTypesSchema.safeParse(parsed)
    if (!result.success) {
      return NextResponse.json(
        { error: 'invalid AI response' },
        { status: 502 },
      )
    }

    return NextResponse.json(result.data, {
      headers: observableModelHeaders(DEFAULT_MODEL),
    })
  } catch {
    return NextResponse.json(
      { error: 'AI service unavailable' },
      { status: 503 },
    )
  }
}
