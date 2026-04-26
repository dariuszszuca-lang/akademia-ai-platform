import { anthropic, DEFAULT_MODEL } from '@/lib/anthropic'
import { findAgent, findTool } from '@/data/agents'
import { getUserContext } from '@/lib/agent/user-context'
import { buildAgentSystemPrompt, buildAgentUserPrompt } from '@/lib/agent/prompts'
import { searchLegal } from '@/lib/legal/search'
import type { LegalChunk } from '@/lib/legal/pinecone'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const { agentId, toolId, context, goal } = await req.json()

  const agent = findAgent(agentId)
  const tool = findTool(agentId, toolId)
  if (!agent || !tool) {
    return new Response(JSON.stringify({ error: 'agent or tool not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const userCtx = await getUserContext()

  // Gate: bez profil.md odmawiamy uruchomienia agenta
  if (!userCtx.profil) {
    return new Response(
      JSON.stringify({ error: 'Najpierw zbuduj profil agenta (/onboarding/express).' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }


  // RAG dla agenta Prawnego: szukaj relewantnych fragmentów ustawowych
  let legalChunks: LegalChunk[] = []
  if (agent.id === 'prawny') {
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
        }

        const llmStream = await anthropic.messages.stream({
          model: DEFAULT_MODEL,
          max_tokens: 2500,
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
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
