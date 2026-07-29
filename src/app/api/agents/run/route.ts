import { anthropic, DEFAULT_MODEL } from '@/lib/anthropic'
import { findAgent, findTool } from '@/data/agents'
import { getUserContext } from '@/lib/agent/user-context'
import { buildAgentSystemPrompt, buildAgentUserPrompt } from '@/lib/agent/prompts'
import { searchLegal } from '@/lib/legal/search'
import type { LegalChunk } from '@/lib/legal/pinecone'
import { getEffectivePlan } from '@/lib/billing/state'
import { PLAN_FEATURES } from '@/lib/billing/plans'
import { rateLimit, LIMITS } from '@/lib/rate-limit'
import { resolveApiUser } from '@/lib/request-auth'
import { observableModelHeaders } from '@/lib/model-id'
import { verifyLegalNoHitProbe } from '@/features/current-release-acceptance/legal-probe'
import { consumeLegalNoHitProbeNonce } from '@/features/current-release-acceptance/legal-probe-replay'
import { LEGAL_NO_SOURCE_MESSAGE } from '@/lib/legal/fallback'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const auth = await resolveApiUser()
  if (!auth.ok) return auth.response
  const userId = auth.userId

  const { agentId, toolId, context, goal } = await req.json()
  const hasRunIdHeader = req.headers.has(
    'x-current-release-run-id',
  )
  const hasNoHitHeader = req.headers.has(
    'x-current-release-legal-no-hit',
  )
  const hasNonceHeader = req.headers.has(
    'x-current-release-legal-nonce',
  )
  const hasExpiresAtHeader = req.headers.has(
    'x-current-release-legal-expires-at',
  )
  const legalNoHitProbeRequested =
    hasRunIdHeader ||
    hasNoHitHeader ||
    hasNonceHeader ||
    hasExpiresAtHeader
  if (legalNoHitProbeRequested) {
    const probeRateLimit = await rateLimit(
      'current-release-legal-probe',
      userId,
      LIMITS.CURRENT_RELEASE_LEGAL_PROBE.limit,
      LIMITS.CURRENT_RELEASE_LEGAL_PROBE.windowMinutes,
    )
    if (!probeRateLimit.ok) {
      return Response.json(
        { error: 'CURRENT_RELEASE_LEGAL_PROBE_RATE_LIMITED' },
        {
          status: 429,
          headers: {
            'Retry-After': String(probeRateLimit.resetIn),
          },
        },
      )
    }
  }

  const expiresAtHeader =
    req.headers.get('x-current-release-legal-expires-at') ?? ''
  const expiresAt =
    /^[1-9][0-9]{9,12}$/.test(expiresAtHeader)
      ? Number(expiresAtHeader)
      : Number.NaN
  const runIdHeader =
    req.headers.get('x-current-release-run-id') ?? ''
  const nonceHeader =
    req.headers.get('x-current-release-legal-nonce') ?? ''
  const legalNoHitProbeSignatureValid =
    legalNoHitProbeRequested &&
    agentId === 'prawny' &&
    hasRunIdHeader &&
    hasNoHitHeader &&
    hasNonceHeader &&
    hasExpiresAtHeader &&
    verifyLegalNoHitProbe({
      acceptanceSecret:
        process.env.CURRENT_RELEASE_ACCEPTANCE_SECRET,
      runId: runIdHeader,
      userId,
      nonce: nonceHeader,
      expiresAt,
      signature:
        req.headers.get('x-current-release-legal-no-hit') ?? '',
    })
  if (
    legalNoHitProbeRequested &&
    !legalNoHitProbeSignatureValid
  ) {
    return Response.json(
      { error: 'CURRENT_RELEASE_LEGAL_PROBE_FORBIDDEN' },
      { status: 403 },
    )
  }
  let legalNoHitProbeAccepted = false
  if (legalNoHitProbeSignatureValid) {
    try {
      legalNoHitProbeAccepted =
        await consumeLegalNoHitProbeNonce({
          runId: runIdHeader,
          userId,
          nonce: nonceHeader,
          expiresAt,
        })
    } catch {
      return Response.json(
        { error: 'CURRENT_RELEASE_LEGAL_PROBE_UNAVAILABLE' },
        { status: 503 },
      )
    }
    if (!legalNoHitProbeAccepted) {
      return Response.json(
        { error: 'CURRENT_RELEASE_LEGAL_PROBE_FORBIDDEN' },
        { status: 403 },
      )
    }
  }

  const agent = findAgent(agentId)
  const tool = findTool(agentId, toolId)
  if (!agent || !tool) {
    return new Response(JSON.stringify({ error: 'agent or tool not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Rate limit per verified user
  const rl = await rateLimit('agent-run', userId, LIMITS.AGENT_RUN.limit, LIMITS.AGENT_RUN.windowMinutes)
  if (!rl.ok) {
    return new Response(
      JSON.stringify({
        error: `Limit ${LIMITS.AGENT_RUN.limit} wywolan/min. Reset za ${rl.resetIn}s.`,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.resetIn) } },
    )
  }

  const userCtx = await getUserContext()

  // Gate: bez profil.md odmawiamy uruchomienia agenta
  if (!userCtx.profil) {
    return new Response(
      JSON.stringify({ error: 'Najpierw zbuduj profil agenta (/onboarding/express).' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }


  // Gate: aktywny plan / trial
  const { plan, active } = await getEffectivePlan()
  if (!active) {
    return new Response(
      JSON.stringify({ error: 'Twój trial wygasł. Wybierz plan w /pricing.' }),
      { status: 402, headers: { 'Content-Type': 'application/json' } },
    )
  }
  const features = plan === 'expired' ? PLAN_FEATURES.starter : PLAN_FEATURES[plan]

  // RAG dla agenta Prawnego: tylko jeśli plan ma ragLegal (Pro+/Trial/Agency)
  let legalChunks: LegalChunk[] = []
  if (
    agent.id === 'prawny' &&
    features.ragLegal &&
    !legalNoHitProbeAccepted
  ) {
    const ragQuery = `${tool.title}\n${context ?? ''}\n${goal ?? ''}`.trim()
    legalChunks = await searchLegal(ragQuery, 5)
  }

  const system = buildAgentSystemPrompt(agent, userCtx, legalChunks)
  const user = buildAgentUserPrompt(tool, context ?? '', goal ?? '')

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Prepend metadata: zrodla prawne (jesli agent prawny)
        if (legalChunks.length > 0) {
          const sources = legalChunks.map(c => ({
            id: c.id,
            ustawa: c.ustawa,
            art: c.art_number,
            ksiega: c.ksiega ?? '',
            url: c.url ?? '',
            score: c.score,
          }))
          const meta = `[[META]]${JSON.stringify({ sources })}[[/META]]\n`
          controller.enqueue(new TextEncoder().encode(meta))
        } else if (agent.id === 'prawny') {
          controller.enqueue(
            new TextEncoder().encode(
              `${LEGAL_NO_SOURCE_MESSAGE}\n\n`,
            ),
          )
        }

        // max_tokens: 6000 zostawia margines dla dlugich dokumentow (agent
        // Prawny: umowy, Wycena: protokoly). Krotsze response (CEO, Marketing)
        // i tak konczy sie wczesniej naturalnie - to limit gorny, nie target.
        const llmStream = await anthropic.messages.stream({
          model: DEFAULT_MODEL,
          max_tokens: 6000,
          system,
          messages: [{ role: 'user', content: user }],
        })

        for await (const event of llmStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(event.delta.text))
          }
        }
        controller.close()
      } catch (err) {
        controller.enqueue(
          new TextEncoder().encode(
            `\n\n[Błąd generowania: ${err instanceof Error ? err.message : 'unknown'}]`,
          ),
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...observableModelHeaders(DEFAULT_MODEL),
    },
  })
}
