import { describe, expect, it } from 'vitest'
import { runNodeStyleHandler } from './adapter'

describe('adapter handlera spacera', () => {
  it('przekazuje body, nagłówki i strumieniuje kolejne linie', async () => {
    const response = await runNodeStyleHandler(async (req, res) => {
      const parts: Uint8Array[] = []
      for await (const c of req) parts.push(c)
      const body = JSON.parse(Buffer.concat(parts).toString('utf8'))
      res.statusCode = 200
      res.setHeader('content-type', 'application/x-ndjson')
      res.write(`${JSON.stringify({ origin: req.headers.origin, typ: body.type })}\n`)
      await new Promise((r) => setTimeout(r, 5))
      res.write(`${JSON.stringify({ stage: 'gotowe' })}\n`)
      res.end()
    }, new Request('http://localhost/api/rzut', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'image/png' }),
    }))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/x-ndjson')
    const lines = (await response.text()).trim().split('\n').map((l) => JSON.parse(l))
    expect(lines).toEqual([{ origin: 'http://localhost:3000', typ: 'image/png' }, { stage: 'gotowe' }])
  })

  it('oddaje kod błędu ustawiony przed end', async () => {
    const response = await runNodeStyleHandler(async (_req, res) => {
      res.statusCode = 403
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'nie' }))
    }, new Request('http://localhost/api/rzut', { method: 'POST' }))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'nie' })
  })

  it('zamienia wyjątek handlera na 500', async () => {
    const response = await runNodeStyleHandler(async () => {
      throw new Error('awaria')
    }, new Request('http://localhost/api/rzut', { method: 'POST' }))
    expect(response.status).toBe(500)
  })
})
