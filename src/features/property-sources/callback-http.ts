import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { verifyCallbackRequest } from './callback-auth'
import type { PropertySourceCallbackConfig } from './callback-config'
import type { AuthenticatedCallback } from './callback-service'

export const propertySourceCallbackHeaders = {
  timestamp: 'x-property-source-timestamp',
  nonce: 'x-property-source-nonce',
  signature: 'x-property-source-signature',
} as const

const MAX_CALLBACK_BODY_BYTES = 512 * 1024

type CallbackService = {
  getExtractionContext(
    rawCommand: unknown,
    auth: AuthenticatedCallback,
  ): Promise<unknown>
  submitExtractionResult(
    rawResult: unknown,
    auth: AuthenticatedCallback,
  ): Promise<unknown>
}

type CallbackHttpDependencies = {
  getService: () => CallbackService
  getConfig: () => PropertySourceCallbackConfig
  now?: () => Date
}

class InvalidCallbackJsonError extends Error {}
class CallbackPayloadTooLargeError extends Error {}

export function createPropertySourceCallbackHttpHandlers({
  getService,
  getConfig,
  now = () => new Date(),
}: CallbackHttpDependencies) {
  const handle = (
    request: Request,
    action: (
      service: CallbackService,
      body: unknown,
      auth: AuthenticatedCallback,
    ) => Promise<unknown>,
  ) =>
    handleSignedCallback(request, getConfig, now, async (body, auth) =>
      action(getService(), body, auth),
    )

  return {
    context: (request: Request) =>
      handle(request, (service, body, auth) =>
        service.getExtractionContext(body, auth),
      ),
    result: (request: Request) =>
      handle(request, (service, body, auth) =>
        service.submitExtractionResult(body, auth),
      ),
  }
}

async function handleSignedCallback(
  request: Request,
  getConfig: CallbackHttpDependencies['getConfig'],
  now: () => Date,
  action: (
    body: unknown,
    auth: AuthenticatedCallback,
  ) => Promise<unknown>,
) {
  try {
    const rawBody = new Uint8Array(await request.arrayBuffer())
    if (rawBody.byteLength > MAX_CALLBACK_BODY_BYTES) {
      throw new CallbackPayloadTooLargeError()
    }

    const receivedAt = now()
    const verified = verifyCallbackRequest({
      secret: getConfig().secret,
      timestamp:
        request.headers.get(propertySourceCallbackHeaders.timestamp) ?? '',
      nonce: request.headers.get(propertySourceCallbackHeaders.nonce) ?? '',
      signature:
        request.headers.get(propertySourceCallbackHeaders.signature) ?? '',
      body: rawBody,
      now: receivedAt,
    })
    const body = parseRawJson(rawBody)
    const result = await action(body, {
      nonce: verified.nonce,
      timestampSeconds: verified.timestampSeconds,
      receivedAt,
    })

    return NextResponse.json(result)
  } catch (error) {
    return callbackErrorResponse(error)
  }
}

function parseRawJson(rawBody: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody))
  } catch {
    throw new InvalidCallbackJsonError()
  }
}

function callbackErrorResponse(error: unknown) {
  if (
    error instanceof Error &&
    (error.message.startsWith('CALLBACK_AUTH_') ||
      error.message === 'CALLBACK_NONCE_INVALID')
  ) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (
    error instanceof Error &&
    error.message === 'CALLBACK_REPLAYED'
  ) {
    return NextResponse.json(
      { error: 'callback_replayed' },
      { status: 409 },
    )
  }

  if (error instanceof InvalidCallbackJsonError) {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (error instanceof CallbackPayloadTooLargeError) {
    return NextResponse.json(
      { error: 'payload_too_large' },
      { status: 413 },
    )
  }

  if (error instanceof ZodError) {
    return NextResponse.json({ error: 'validation_error' }, { status: 400 })
  }

  if (
    error instanceof Error &&
    ['JOB_NOT_FOUND', 'SOURCE_NOT_FOUND'].includes(error.message)
  ) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (
    error instanceof Error &&
    [
      'IDEMPOTENCY_KEY_REUSED',
      'JOB_ALREADY_COMPLETED',
      'JOB_CONTEXT_MISMATCH',
      'JOB_NOT_ACTIVE',
      'JOB_SOURCE_MISMATCH',
      'SOURCE_CHECKSUM_MISMATCH',
      'SOURCE_CONTEXT_NOT_FOUND',
      'SOURCE_NOT_READY',
    ].includes(error.message)
  ) {
    return NextResponse.json(
      { error: 'callback_conflict' },
      { status: 409 },
    )
  }

  if (
    error instanceof Error &&
    (error.message.startsWith('Missing runtime variable:') ||
      error.message.startsWith('Invalid runtime variable:'))
  ) {
    return NextResponse.json(
      { error: 'callback_unavailable' },
      { status: 503 },
    )
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error('[property-source-callback] request_failed', {
      type: error instanceof Error ? error.name : 'unknown',
    })
  }
  return NextResponse.json({ error: 'internal_error' }, { status: 500 })
}
