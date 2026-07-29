import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { currentReleaseRunIdSchema } from './domain'

const legalProbeUserIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )
const legalProbePasswordSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((value) => value.trim().length > 0)
const legalProbeSignatureSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)

const legalProbeSigningInputSchema = z
  .object({
    adminPassword: legalProbePasswordSchema,
    runId: currentReleaseRunIdSchema,
    userId: legalProbeUserIdSchema,
  })
  .strict()

const LEGAL_PROBE_DOMAIN = 'current-release-legal-no-hit-v1'

export function signLegalNoHitProbe(input: {
  adminPassword: string
  runId: string
  userId: string
}): string {
  const parsed = legalProbeSigningInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error('CURRENT_RELEASE_LEGAL_PROBE_INVALID')
  }
  return createSignature(parsed.data)
}

export function verifyLegalNoHitProbe(input: {
  adminPassword: string | undefined
  runId: string
  userId: string
  signature: string
}): boolean {
  const parsed = legalProbeSigningInputSchema.safeParse({
    adminPassword: input.adminPassword,
    runId: input.runId,
    userId: input.userId,
  })
  const parsedSignature = legalProbeSignatureSchema.safeParse(
    input.signature,
  )
  if (!parsed.success || !parsedSignature.success) return false

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
  return createHmac('sha256', input.adminPassword)
    .update(`${LEGAL_PROBE_DOMAIN}:${input.runId}:${input.userId}`)
    .digest('hex')
}
