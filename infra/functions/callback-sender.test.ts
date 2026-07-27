import { describe, expect, it, vi } from 'vitest'
import { verifyCallbackRequest } from '../../src/features/property-sources/callback-auth'
import { createCallbackSenderHandler } from './callback-sender'

const secret = 'callback-secret-with-at-least-thirty-two-characters'

describe('signed Studio callback worker', () => {
  it('fetches context with a signature over the exact body and returns no secret', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jobId: '00000000-0000-4000-8000-000000000004',
          source: { id: '00000000-0000-4000-8000-000000000003' },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    )
    const handler = createCallbackSenderHandler({
      baseUrl: 'https://akademia-ai-platform.vercel.app',
      getSecret: vi.fn().mockResolvedValue(secret),
      fetch,
      now: () => new Date('2026-07-27T12:00:00.000Z'),
      createNonce: () => 'a'.repeat(32),
    })
    const event = {
      action: 'context' as const,
      payload: {
        sourceId: '00000000-0000-4000-8000-000000000003',
        idempotencyKey: `source-${'b'.repeat(64)}`,
        attempt: 1,
        pipelineVersion: 'property-source-v1',
      },
      bucketName: 'property-studio-dev-sources',
    }

    const result = await handler(event)

    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(
      'https://akademia-ai-platform.vercel.app/api/internal/property-sources/context',
    )
    const body = new TextEncoder().encode(init.body)
    expect(
      verifyCallbackRequest({
        secret,
        timestamp: init.headers['x-property-source-timestamp'],
        nonce: init.headers['x-property-source-nonce'],
        signature: init.headers['x-property-source-signature'],
        body,
        now: new Date('2026-07-27T12:00:00.000Z'),
      }),
    ).toMatchObject({ nonce: 'a'.repeat(32) })
    expect(result).toMatchObject({
      bucketName: 'property-studio-dev-sources',
      context: {
        jobId: '00000000-0000-4000-8000-000000000004',
      },
    })
    expect(JSON.stringify(result)).not.toContain(secret)
  })

  it('submits only the explicit result payload', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ accepted: true, outcome: 'succeeded' }),
          { status: 200 },
        ),
      )
    const handler = createCallbackSenderHandler({
      baseUrl: 'https://akademia-ai-platform.vercel.app',
      getSecret: vi.fn().mockResolvedValue(secret),
      fetch,
      now: () => new Date('2026-07-27T12:00:00.000Z'),
      createNonce: () => 'c'.repeat(32),
    })
    const resultPayload = {
      sourceId: '00000000-0000-4000-8000-000000000003',
      jobId: '00000000-0000-4000-8000-000000000004',
      checksumSha256: 'd'.repeat(64),
      attempt: 1,
      pipelineVersion: 'property-source-v1',
      outcome: 'needs_manual_review',
      errorCode: 'TRANSCRIPTION_FAILED',
    }

    const response = await handler({
      action: 'result',
      payload: resultPayload,
      context: { mustNotBeSent: true },
    })

    const [url, init] = fetch.mock.calls[0]
    expect(url).toContain('/api/internal/property-sources/result')
    expect(JSON.parse(init.body)).toEqual(resultPayload)
    expect(response).toEqual({
      accepted: true,
      outcome: 'succeeded',
    })
  })

  it('maps remote response content to a safe technical error', async () => {
    const handler = createCallbackSenderHandler({
      baseUrl: 'https://akademia-ai-platform.vercel.app',
      getSecret: vi.fn().mockResolvedValue(secret),
      fetch: vi.fn().mockResolvedValue(
        new Response('private provider details', { status: 500 }),
      ),
      now: () => new Date('2026-07-27T12:00:00.000Z'),
      createNonce: () => 'e'.repeat(32),
    })

    await expect(
      handler({ action: 'result', payload: { safe: true } }),
    ).rejects.toThrow('STUDIO_CALLBACK_FAILED_500')
  })
})
