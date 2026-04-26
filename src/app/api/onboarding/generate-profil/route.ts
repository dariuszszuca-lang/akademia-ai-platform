import { anthropic, DEFAULT_MODEL } from '@/lib/anthropic'
import { buildGenerateProfilPrompt } from '@/lib/onboarding/prompts'
import { getOnboardingState, saveProfilMd } from '@/lib/onboarding/state'
import { expressQuestions } from '@/data/onboarding/express'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  const state = await getOnboardingState()

  // Walidacja: wszystkie 15 pytan musi miec odpowiedzi
  const missing = expressQuestions.filter(q => !state.expressAnswers[q.id]?.trim())
  if (missing.length > 0) {
    return new Response(
      JSON.stringify({ error: 'missing answers', missing: missing.map(q => q.id) }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { system, user } = buildGenerateProfilPrompt(state.expressAnswers)

  // Streaming response do UI (premium feel - widac jak AI pisze)
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const llmStream = await anthropic.messages.stream({
          model: DEFAULT_MODEL,
          max_tokens: 2000,
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

        // Po zakonczeniu streamu - zapisz pelny markdown do KV
        await saveProfilMd(full)
        controller.close()
      } catch (err) {
        controller.enqueue(
          new TextEncoder().encode(
            `\n\n[Blad generowania: ${err instanceof Error ? err.message : 'unknown'}]`,
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
