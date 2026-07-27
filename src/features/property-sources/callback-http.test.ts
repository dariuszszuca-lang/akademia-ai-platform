import { describe, expect, it, vi } from 'vitest'
import { createCallbackSignature } from './callback-auth'
import { createPropertySourceCallbackHttpHandlers } from './callback-http'
import type { AuthenticatedCallback } from './callback-service'

const secret = 'x'.repeat(32)
const now = new Date('2026-07-27T12:05:00.000Z')
const timestamp = String(Math.floor(now.getTime() / 1000))

describe('property source callback HTTP handlers', () => {
  it('authenticates the exact raw context body before parsing it', async () => {
    const getExtractionContext = vi.fn().mockResolvedValue({
      jobId: '00000000-0000-4000-8000-000000000001',
    })
    const handlers = createHandlers({ getExtractionContext })
    const body = JSON.stringify({ sourceId: 'source-1' })
    const request = signedRequest('/context', body)
    const readBody = vi.spyOn(request, 'arrayBuffer')

    const response = await handlers.context(request)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      jobId: '00000000-0000-4000-8000-000000000001',
    })
    expect(readBody).toHaveBeenCalledTimes(1)
    expect(getExtractionContext).toHaveBeenCalledWith(
      { sourceId: 'source-1' },
      {
        nonce: 'callback_nonce_123456789012345678',
        timestampSeconds: Number(timestamp),
        receivedAt: now,
      },
    )
  })

  it('routes a valid result callback to the result service', async () => {
    const submitExtractionResult = vi.fn().mockResolvedValue({
      accepted: true,
      outcome: 'succeeded',
      proposalCount: 1,
    })
    const handlers = createHandlers({ submitExtractionResult })
    const body = JSON.stringify({ jobId: 'job-1' })

    const response = await handlers.result(signedRequest('/result', body))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      accepted: true,
      outcome: 'succeeded',
      proposalCount: 1,
    })
    expect(submitExtractionResult).toHaveBeenCalledOnce()
  })

  it('returns generic 401 before parsing malformed JSON with a bad signature', async () => {
    const getExtractionContext = vi.fn()
    const handlers = createHandlers({ getExtractionContext })
    const request = signedRequest('/context', '{malformed', {
      signature: 'f'.repeat(64),
    })

    const response = await handlers.context(request)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'unauthorized' })
    expect(getExtractionContext).not.toHaveBeenCalled()
  })

  it('returns invalid_json only after a valid signature', async () => {
    const handlers = createHandlers()
    const response = await handlers.context(
      signedRequest('/context', '{malformed'),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_json' })
  })

  it('maps stale authentication and nonce replay without leaking details', async () => {
    const handlers = createHandlers({
      getExtractionContext: vi
        .fn()
        .mockRejectedValue(new Error('CALLBACK_REPLAYED')),
    })
    const body = JSON.stringify({ sourceId: 'source-1' })
    const staleTimestamp = String(Number(timestamp) - 301)
    const staleResponse = await handlers.context(
      signedRequest('/context', body, { timestamp: staleTimestamp }),
    )
    const replayResponse = await handlers.context(
      signedRequest('/context', body),
    )

    expect(staleResponse.status).toBe(401)
    expect(await staleResponse.json()).toEqual({ error: 'unauthorized' })
    expect(replayResponse.status).toBe(409)
    const replayBody = await replayResponse.json()
    expect(replayBody).toEqual({
      error: 'callback_replayed',
    })
    expect(JSON.stringify(replayBody)).not.toContain('secret-provider-data')
  })

  it('returns a safe internal error without signatures or provider details', async () => {
    const handlers = createHandlers({
      submitExtractionResult: vi
        .fn()
        .mockRejectedValue(new Error('arn:aws:states:eu:test document text')),
    })
    const body = JSON.stringify({ jobId: 'job-1' })
    const response = await handlers.result(signedRequest('/result', body))
    const responseBody = JSON.stringify(await response.json())

    expect(response.status).toBe(500)
    expect(responseBody).toBe('{"error":"internal_error"}')
    expect(responseBody).not.toContain('arn:aws')
    expect(responseBody).not.toContain('document text')
  })

  it('rejects callback bodies over the bounded limit', async () => {
    const handlers = createHandlers()
    const body = JSON.stringify({ value: 'a'.repeat(512 * 1024) })
    const response = await handlers.context(signedRequest('/context', body))

    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: 'payload_too_large' })
  })
})

function createHandlers(
  overrides: {
    getExtractionContext?: (
      input: unknown,
      auth: AuthenticatedCallback,
    ) => Promise<unknown>
    submitExtractionResult?: (
      input: unknown,
      auth: AuthenticatedCallback,
    ) => Promise<unknown>
  } = {},
) {
  return createPropertySourceCallbackHttpHandlers({
    getService: () => ({
      getExtractionContext:
        overrides.getExtractionContext ??
        vi.fn().mockResolvedValue({ jobId: 'job-1' }),
      submitExtractionResult:
        overrides.submitExtractionResult ??
        vi.fn().mockResolvedValue({ accepted: true }),
    }),
    getConfig: () => ({ secret }),
    now: () => now,
  })
}

function signedRequest(
  path: string,
  body: string,
  overrides: { timestamp?: string; signature?: string } = {},
) {
  const requestTimestamp = overrides.timestamp ?? timestamp
  const nonce = 'callback_nonce_123456789012345678'
  const bodyBytes = new TextEncoder().encode(body)
  const signature =
    overrides.signature ??
    createCallbackSignature({
      secret,
      timestamp: requestTimestamp,
      nonce,
      body: bodyBytes,
    })

  return new Request(`https://studio.example/api/internal${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-property-source-timestamp': requestTimestamp,
      'x-property-source-nonce': nonce,
      'x-property-source-signature': signature,
    },
    body,
  })
}
