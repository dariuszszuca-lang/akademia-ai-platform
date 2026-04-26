import { anthropic, DEFAULT_MODEL } from '@/lib/anthropic'
import { findAgent, findTool } from '@/data/agents'
import { getUserContext } from '@/lib/agent/user-context'
import { buildAgentSystemPrompt, buildAgentUserPrompt } from '@/lib/agent/prompts'

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
  const system = buildAgentSystemPrompt(agent, userCtx)
  const user = buildAgentUserPrompt(tool, context ?? '', goal ?? '')

  const stream = new ReadableStream({
    async start(controller) {
      try {
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
