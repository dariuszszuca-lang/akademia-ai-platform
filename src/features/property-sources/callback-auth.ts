import crypto from 'node:crypto'

const CALLBACK_MAX_AGE_SECONDS = 300
const CALLBACK_MAX_FUTURE_SKEW_SECONDS = 30
const callbackNoncePattern = /^[A-Za-z0-9_-]{32,128}$/
const callbackSignaturePattern = /^[a-f0-9]{64}$/
const callbackTimestampPattern = /^\d{1,12}$/

type CallbackSignatureInput = {
  secret: string
  timestamp: string
  nonce: string
  body: Uint8Array
}

type VerifyCallbackRequestInput = CallbackSignatureInput & {
  signature: string
  now?: Date
}

export function createCallbackSignature({
  secret,
  timestamp,
  nonce,
  body,
}: CallbackSignatureInput): string {
  const bodySha256 = hashCallbackBody(body)
  const canonical = [timestamp, nonce, bodySha256].join('\n')

  return crypto
    .createHmac('sha256', secret)
    .update(canonical)
    .digest('hex')
}

export function verifyCallbackRequest({
  secret,
  timestamp,
  nonce,
  signature,
  body,
  now = new Date(),
}: VerifyCallbackRequestInput) {
  if (!timestamp || !nonce || !signature) {
    throw new Error('CALLBACK_AUTH_MISSING')
  }
  if (!callbackNoncePattern.test(nonce)) {
    throw new Error('CALLBACK_NONCE_INVALID')
  }
  if (
    !callbackTimestampPattern.test(timestamp) ||
    !callbackSignaturePattern.test(signature)
  ) {
    throw new Error('CALLBACK_AUTH_INVALID')
  }

  const timestampSeconds = Number(timestamp)
  const nowSeconds = Math.floor(now.getTime() / 1000)
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    nowSeconds - timestampSeconds > CALLBACK_MAX_AGE_SECONDS
  ) {
    throw new Error('CALLBACK_AUTH_STALE')
  }
  if (timestampSeconds - nowSeconds > CALLBACK_MAX_FUTURE_SKEW_SECONDS) {
    throw new Error('CALLBACK_AUTH_FUTURE')
  }

  const expected = createCallbackSignature({
    secret,
    timestamp,
    nonce,
    body,
  })
  const signatureBytes = Buffer.from(signature, 'hex')
  const expectedBytes = Buffer.from(expected, 'hex')
  if (
    signatureBytes.length !== expectedBytes.length ||
    !crypto.timingSafeEqual(signatureBytes, expectedBytes)
  ) {
    throw new Error('CALLBACK_AUTH_INVALID')
  }

  return {
    timestampSeconds,
    nonce,
    bodySha256: hashCallbackBody(body),
  }
}

export function hashCallbackNonce(nonce: string): string {
  if (!callbackNoncePattern.test(nonce)) {
    throw new Error('CALLBACK_NONCE_INVALID')
  }
  return crypto.createHash('sha256').update(nonce).digest('hex')
}

function hashCallbackBody(body: Uint8Array): string {
  return crypto.createHash('sha256').update(body).digest('hex')
}
