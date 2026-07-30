import { anthropic, DEFAULT_MODEL } from '@/lib/anthropic'
import { buildGenerateProfilPrompt } from '@/lib/onboarding/prompts'
import { getOnboardingState, saveProfilMd } from '@/lib/onboarding/state'
import { expressQuestions } from '@/data/onboarding/express'
import { resolveApiUser } from '@/lib/request-auth'
import { observableModelHeaders } from '@/lib/model-id'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  const auth = await resolveApiUser()
  if (!auth.ok) return auth.response

  const state = await getOnboardingState()

  // Walidacja: wszystkie 15 pytan musi miec odpowiedzi
  const missing = expressQuestions.filter(q => !state.expressAnswers[q.id]?.trim())
  if (missing.length > 0) {
    return new Response(
      JSON.stringify({ error: 'missing answers', missing: missing.map(q => q.id) }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const sourceName = exactSourceName(
    state.expressAnswers.q1 ?? '',
  )
  if (!sourceName) {
    return new Response(
      JSON.stringify({ error: 'invalid basic identity' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  const { system, user } = buildGenerateProfilPrompt(state.expressAnswers)

  // Streaming response do UI (premium feel - widac jak AI pisze)
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let pending = ''
      let full = ''
      let exactNameWritten = false
      const emit = (text: string) => {
        full += text
        controller.enqueue(encoder.encode(text))
      }
      const emitLine = (line: string) => {
        const corrected = replaceProfileNameLine(
          line,
          sourceName,
        )
        exactNameWritten ||= corrected.replaced
        emit(corrected.value)
      }
      const emitCompleteLines = () => {
        let newlineIndex = pending.indexOf('\n')
        while (newlineIndex >= 0) {
          emitLine(pending.slice(0, newlineIndex + 1))
          pending = pending.slice(newlineIndex + 1)
          newlineIndex = pending.indexOf('\n')
        }
      }

      try {
        const llmStream = await anthropic.messages.stream({
          model: DEFAULT_MODEL,
          max_tokens: 2000,
          system,
          messages: [{ role: 'user', content: user }],
        })

        for await (const event of llmStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            pending += event.delta.text
            emitCompleteLines()
          }
        }
        if (pending) {
          emitLine(pending)
          pending = ''
        }
        if (!exactNameWritten) {
          emit(
            `${full.endsWith('\n') || full.length === 0 ? '' : '\n'}- Imię: ${sourceName}\n`,
          )
        }

        // Po zakonczeniu streamu - zapisz pelny markdown do KV
        await saveProfilMd(full)
        controller.close()
      } catch {
        controller.enqueue(
          encoder.encode(
            '\n\n[Błąd generowania: usługa AI jest chwilowo niedostępna]',
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

function exactSourceName(answer: string): string | null {
  const name = answer.split(/[,\r\n]/u, 1)[0]?.trim() ?? ''
  if (
    name.length === 0 ||
    name.length > 160 ||
    /[\u0000-\u001f\u007f]/u.test(name)
  ) {
    return null
  }
  return name
}

function replaceProfileNameLine(
  line: string,
  sourceName: string,
): { value: string; replaced: boolean } {
  const newline = line.endsWith('\r\n')
    ? '\r\n'
    : line.endsWith('\n')
      ? '\n'
      : ''
  const content = newline ? line.slice(0, -newline.length) : line
  if (!/^\s*-\s*Imię\s*:/iu.test(content)) {
    return { value: line, replaced: false }
  }
  return {
    value: `- Imię: ${sourceName}${newline}`,
    replaced: true,
  }
}
