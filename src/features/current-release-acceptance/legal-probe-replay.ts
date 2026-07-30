import { createHash } from 'node:crypto'
import { z } from 'zod'
import { storeIncrementWithExpiry } from '@/lib/store'
import { cognitoSubjectSchema } from '../synthetic-acceptance/cognito-subject'
import { currentReleaseRunIdSchema } from './domain'
import {
  CURRENT_RELEASE_LEGAL_PROBE_MAX_TTL_SECONDS,
  legalProbeExpiresAtSchema,
  legalProbeNonceSchema,
} from './legal-probe'

const replayInputSchema = z
  .object({
    runId: currentReleaseRunIdSchema,
    userId: cognitoSubjectSchema,
    nonce: legalProbeNonceSchema,
    expiresAt: legalProbeExpiresAtSchema,
  })
  .strict()

type IncrementWithExpiry = (
  key: string,
  expiresAtEpochSeconds: number,
) => Promise<number>

export async function consumeLegalNoHitProbeNonce(
  input: {
    runId: string
    userId: string
    nonce: string
    expiresAt: number
  },
  increment: IncrementWithExpiry = storeIncrementWithExpiry,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const parsed = replayInputSchema.safeParse(input)
  if (
    !parsed.success ||
    !Number.isSafeInteger(nowEpochSeconds) ||
    parsed.data.expiresAt <= nowEpochSeconds ||
    parsed.data.expiresAt - nowEpochSeconds >
      CURRENT_RELEASE_LEGAL_PROBE_MAX_TTL_SECONDS
  ) {
    return false
  }

  const digest = createHash('sha256')
    .update(
      `current-release-legal-no-hit-replay-v1:${parsed.data.runId}:${parsed.data.userId}:${parsed.data.nonce}`,
    )
    .digest('hex')
  const count = await increment(
    `current-release:legal-no-hit:${digest}`,
    parsed.data.expiresAt,
  )
  return count === 1
}
