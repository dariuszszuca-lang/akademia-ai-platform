import { anthropic, DEFAULT_MODEL } from '@/lib/anthropic'
import { buildExtendProfilWithDeepPrompt } from '@/lib/onboarding/prompts'
import { getOnboardingState, getProfilMd, saveExtendedProfilMd } from '@/lib/onboarding/state'
import { deepQuestions } from '@/data/onboarding/deep'

export const runtime = 'nodejs'
export const maxDuration = 90

export async function POST() {
  const profilMd = await getProfilMd()
  if (!profilMd) {
    return new Response(JSON.stringify({ error: 'no base profil' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const state = await getOnboardingState()
  const missing = deepQuestions.filter(q => !state.deepAnswers[q.id]?.trim())
  if (missing.length > 0) {
    return new Response(
      JSON.stringify({ error: 'missing answers', missing: missing.map(q => q.id) }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { system, user } = buildExtendProfilWithDeepPrompt(profilMd, state.deepAnswers)

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const llmStream = await anthropic.messages.stream({
          model: DEFAULT_MODEL,
          max_tokens: 4000,
          system,
          messages: [{ role: 'user', content: user }],
        })

        let full = ''
        for await (const event of llmStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const chunk = event.delta.text
            full += chunk
            controller.enqueue(new TextEncoder().encode(chunk))
          }
        }

        await saveExtendedProfilMd(full)
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
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
