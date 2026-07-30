import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { z } from 'zod'
import { cognitoSubjectSchema } from '../synthetic-acceptance/cognito-subject'
import { currentReleaseRunIdSchema } from './domain'

export const CURRENT_RELEASE_LEGAL_PROBE_MAX_TTL_SECONDS = 60

export const currentReleaseAcceptanceSecretSchema = z
  .string()
  .min(43)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/)
export const legalProbeNonceSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/)
export const legalProbeExpiresAtSchema = z
  .number()
  .int()
  .positive()
const legalProbeSignatureSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)

const legalProbeSigningInputSchema = z
  .object({
    acceptanceSecret: currentReleaseAcceptanceSecretSchema,
    runId: currentReleaseRunIdSchema,
    userId: cognitoSubjectSchema,
    nonce: legalProbeNonceSchema,
    expiresAt: legalProbeExpiresAtSchema,
  })
  .strict()

const LEGAL_PROBE_DOMAIN = 'current-release-legal-no-hit-v2'

export function createLegalNoHitProbeNonce(): string {
  return randomBytes(32).toString('base64url')
}

export function signLegalNoHitProbe(input: {
  acceptanceSecret: string
  runId: string
  userId: string
  nonce: string
  expiresAt: number
}, nowEpochSeconds = currentEpochSeconds()): string {
  const parsed = legalProbeSigningInputSchema.safeParse(input)
  if (
    !parsed.success ||
    !isValidTemporalWindow(parsed.data.expiresAt, nowEpochSeconds)
  ) {
    throw new Error('CURRENT_RELEASE_LEGAL_PROBE_INVALID')
  }
  return createSignature(parsed.data)
}

export function verifyLegalNoHitProbe(input: {
  acceptanceSecret: string | undefined
  runId: string
  userId: string
  nonce: string
  expiresAt: number
  signature: string
}, nowEpochSeconds = currentEpochSeconds()): boolean {
  const parsed = legalProbeSigningInputSchema.safeParse({
    acceptanceSecret: input.acceptanceSecret,
    runId: input.runId,
    userId: input.userId,
    nonce: input.nonce,
    expiresAt: input.expiresAt,
  })
  const parsedSignature = legalProbeSignatureSchema.safeParse(
    input.signature,
  )
  if (
    !parsed.success ||
    !parsedSignature.success ||
    !isValidTemporalWindow(parsed.data.expiresAt, nowEpochSeconds)
  ) {
    return false
  }

  const expected = Buffer.from(createSignature(parsed.data), 'hex')
  const provided = Buffer.from(parsedSignature.data, 'hex')
  return (
    expected.length === provided.length &&
    timingSafeEqual(expected, provided)
  )
}

function createSignature(
  input: z.infer<typeof legalProbeSigningInputSchema>,
): string {
  return createHmac('sha256', input.acceptanceSecret)
    .update(
      `${LEGAL_PROBE_DOMAIN}:${input.runId}:${input.userId}:${input.nonce}:${input.expiresAt}`,
    )
    .digest('hex')
}

function currentEpochSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function isValidTemporalWindow(
  expiresAt: number,
  nowEpochSeconds: number,
): boolean {
  return (
    Number.isSafeInteger(nowEpochSeconds) &&
    expiresAt > nowEpochSeconds &&
    expiresAt - nowEpochSeconds <=
      CURRENT_RELEASE_LEGAL_PROBE_MAX_TTL_SECONDS
  )
}
