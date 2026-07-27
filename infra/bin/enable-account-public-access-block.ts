#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import {
  enableAccountPublicAccessBlock,
  EXPECTED_AWS_ACCOUNT,
  EXPECTED_AWS_REGION,
  type AwsCliRunner,
} from '../account-public-access-block'

const cli: AwsCliRunner = {
  run(args) {
    try {
      return execFileSync('aws', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'stderr' in error &&
        Buffer.isBuffer(error.stderr)
      ) {
        throw new Error(error.stderr.toString('utf8').trim())
      }
      throw error
    }
  },
}

try {
  const state = enableAccountPublicAccessBlock(cli, {
    profile: process.env.AWS_PROFILE ?? 'akademia-ai',
    region: process.env.AWS_REGION ?? EXPECTED_AWS_REGION,
  })

  process.stdout.write(
    `${JSON.stringify({
      account: EXPECTED_AWS_ACCOUNT,
      region: EXPECTED_AWS_REGION,
      publicAccessBlock: state,
    })}\n`,
  )
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Unknown baseline error'
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
