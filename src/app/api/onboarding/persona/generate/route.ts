import { anthropic, DEFAULT_MODEL } from '@/lib/anthropic'
import { buildGeneratePersonaPrompt } from '@/lib/onboarding/persona-prompts'
import { getOnboardingState, getProfilMd, savePersonaMd } from '@/lib/onboarding/state'
import { getPersonaQuestions } from '@/data/onboarding/persona-questions'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const { type } = await req.json()
  if (type !== 'buyer' && type !== 'seller') {
    return new Response(JSON.stringify({ error: 'invalid type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const profilMd = await getProfilMd()
  if (!profilMd) {
    return new Response(JSON.stringify({ error: 'profil not generated yet' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const state = await getOnboardingState()
  const slot = type === 'buyer' ? state.personaBuyer : state.personaSeller

  // Walidacja: wszystkie 6 pytan
  const questions = getPersonaQuestions(type)
  const missing = questions.filter(q => !slot.answers[q.id]?.trim())
  if (missing.length > 0) {
    return new Response(
      JSON.stringify({ error: 'missing answers', missing: missing.map(q => q.id) }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { system, user } = buildGeneratePersonaPrompt(type, profilMd, slot.answers)

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const llmStream = await anthropic.messages.stream({
          model: DEFAULT_MODEL,
          max_tokens: 2500,
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

        await savePersonaMd(type, full)
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
