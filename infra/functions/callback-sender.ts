import crypto from 'node:crypto'
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'
import { z } from 'zod'
import { createCallbackSignature } from '../../src/features/property-sources/callback-auth'

const callbackBaseUrlSchema = z
  .url()
  .refine(
    (value) =>
      new URL(value).protocol === 'https:' &&
      new URL(value).pathname === '/',
  )
const callbackEventSchema = z
  .object({
    action: z.enum(['context', 'result']),
    payload: z.unknown(),
  })
  .passthrough()

type FetchLike = (
  input: string,
  init: RequestInit,
) => Promise<Response>

type CallbackSenderDependencies = {
  baseUrl: string
  getSecret: () => Promise<string>
  fetch: FetchLike
  now?: () => Date
  createNonce?: () => string
}

export function createCallbackSenderHandler({
  baseUrl: rawBaseUrl,
  getSecret,
  fetch: fetchRequest,
  now = () => new Date(),
  createNonce = () => crypto.randomBytes(32).toString('base64url'),
}: CallbackSenderDependencies) {
  const baseUrl = callbackBaseUrlSchema.parse(rawBaseUrl)

  return async (rawEvent: unknown) => {
    const event = callbackEventSchema.parse(rawEvent)
    const bodyText = JSON.stringify(event.payload)
    if (bodyText === undefined) throw new Error('CALLBACK_PAYLOAD_INVALID')
    const body = new TextEncoder().encode(bodyText)
    const timestamp = String(Math.floor(now().getTime() / 1000))
    const nonce = createNonce()
    const secret = await getSecret()
    if (secret.length < 32) throw new Error('CALLBACK_SECRET_INVALID')
    const signature = createCallbackSignature({
      secret,
      timestamp,
      nonce,
      body,
    })

    const response = await fetchRequest(
      new URL(
        `/api/internal/property-sources/${event.action}`,
        baseUrl,
      ).toString(),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-property-source-timestamp': timestamp,
          'x-property-source-nonce': nonce,
          'x-property-source-signature': signature,
        },
        body: bodyText,
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!response.ok) {
      throw new Error(`STUDIO_CALLBACK_FAILED_${response.status}`)
    }

    const result = await response.json()
    return event.action === 'context'
      ? { ...event, context: result }
      : result
  }
}

let defaultHandler:
  | ReturnType<typeof createCallbackSenderHandler>
  | undefined

export async function handler(event: unknown) {
  defaultHandler ??= createCallbackSenderHandler({
    baseUrl: process.env.STUDIO_CALLBACK_BASE_URL ?? '',
    getSecret: createSecretReader(
      process.env.CALLBACK_SECRET_ARN ?? '',
    ),
    fetch,
  })
  return defaultHandler(event)
}

function createSecretReader(secretId: string) {
  if (
    !/^arn:aws:secretsmanager:eu-central-1:\d{12}:secret:property-studio\/(?:dev|prod)\/source-callback-[A-Za-z0-9]{6}$/.test(
      secretId,
    )
  ) {
    throw new Error('CALLBACK_SECRET_ARN_INVALID')
  }
  const client = new SecretsManagerClient({})
  let cachedSecret: string | undefined

  return async () => {
    if (cachedSecret) return cachedSecret
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretId }),
    )
    if (!response.SecretString) {
      throw new Error('CALLBACK_SECRET_UNAVAILABLE')
    }
    cachedSecret = response.SecretString
    return cachedSecret
  }
}
