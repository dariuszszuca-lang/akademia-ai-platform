import { anthropic, DEFAULT_MODEL } from '@/lib/anthropic'
import { buildExpandTypePrompt } from '@/lib/onboarding/persona-prompts'
import { getProfilMd, savePersonaMd, setPersonaChosenType } from '@/lib/onboarding/state'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const { type, chosenType, chosenIndex } = await req.json()
  if (type !== 'buyer' && type !== 'seller') {
    return new Response(JSON.stringify({ error: 'invalid type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (
    !chosenType ||
    typeof chosenType.name !== 'string' ||
    typeof chosenType.who !== 'string' ||
    typeof chosenType.problem !== 'string' ||
    typeof chosenType.match !== 'string'
  ) {
    return new Response(JSON.stringify({ error: 'invalid chosenType' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const profilMd = await getProfilMd()
  if (!profilMd) {
    return new Response(JSON.stringify({ error: 'profil not generated' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (chosenIndex === 1 || chosenIndex === 2 || chosenIndex === 3) {
    await setPersonaChosenType(type, chosenIndex)
  }

  const { system, user } = buildExpandTypePrompt(type, profilMd, chosenType)

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
            `\n\n[Błąd: ${err instanceof Error ? err.message : 'unknown'}]`,
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
