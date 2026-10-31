import type { RzutRequest, RzutResponse } from './rzut.mjs'

type NodeStyleHandler = (req: RzutRequest, res: RzutResponse) => Promise<void>

/**
 * Uruchamia handler w stylu Node (req, res) z kopii spacera wewnątrz route handlera Next.js.
 * Odpowiedź strumieniowa (ndjson) idzie do klienta na bieżąco.
 */
export async function runNodeStyleHandler(
  handler: NodeStyleHandler,
  request: Request,
): Promise<Response> {
  const body = new Uint8Array(await request.arrayBuffer())
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  const req: RzutRequest = {
    method: request.method,
    headers,
    async *[Symbol.asyncIterator]() {
      if (body.length) yield body
    },
  }

  const encoder = new TextEncoder()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })

  let resolveHead!: () => void
  const headReady = new Promise<void>((resolve) => {
    resolveHead = resolve
  })
  const outHeaders = new Headers()
  let closed = false

  const res: RzutResponse = {
    statusCode: 200,
    setHeader(name, value) {
      outHeaders.set(name, value)
    },
    write(chunk) {
      resolveHead()
      if (!closed) controller.enqueue(encoder.encode(chunk))
      return true
    },
    end(chunk) {
      if (chunk && !closed) controller.enqueue(encoder.encode(chunk))
      resolveHead()
      if (!closed) {
        closed = true
        controller.close()
      }
    },
  }

  const done = handler(req, res).catch(() => {
    if (!closed) {
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Nie udało się odczytać rzutu.' }))
    }
  })

  await Promise.race([headReady, done])
  return new Response(stream, { status: res.statusCode, headers: outHeaders })
}
