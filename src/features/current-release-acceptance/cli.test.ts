import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  mapCurrentReleasePreflightError,
  parseCurrentReleaseCliArgs,
  runCurrentReleaseCli,
} from '../../../scripts/current-release-acceptance'

const validArgs = [
  '--allow-production',
  '--base-url',
  'https://akademia-ai-platform.vercel.app',
  '--max-cost-usd',
  '2',
]

describe('current release acceptance CLI', () => {
  it('accepts only the exact explicit production command', () => {
    expect(parseCurrentReleaseCliArgs(validArgs)).toEqual({
      allowProduction: true,
      baseUrl: 'https://akademia-ai-platform.vercel.app',
      maxCostUsd: 2,
    })
  })

  const invalidArgs = [
    validArgs.slice(1),
    [...validArgs, '--unknown'],
    [...validArgs, '--allow-production'],
    [...validArgs, '--base-url', 'https://example.invalid'],
    [...validArgs, '--max-cost-usd'],
    [
      '--allow-production',
      '--base-url',
      'https://akademia-ai-platform.vercel.app',
      '--base-url',
      'https://akademia-ai-platform.vercel.app',
      '--max-cost-usd',
      '2',
    ],
    [
      '--allow-production',
      '--base-url',
      'https://akademia-ai-platform.vercel.app',
      '--max-cost-usd',
      '2.0',
    ],
  ]

  it.each(invalidArgs.map((args) => [args] as const))(
    'rejects unknown, duplicate or malformed arguments',
    (args) => {
      expect(() => parseCurrentReleaseCliArgs(args)).toThrow(
        'CURRENT_RELEASE_CLI_INVALID',
      )
    },
  )

  it('returns exit code 1 and a secret-free summary for rejected acceptance', async () => {
    const output: string[] = []
    const errorOutput: string[] = []
    const code = await runCurrentReleaseCli(validArgs, {
      execute: async () => {
        throw new Error('CURRENT_RELEASE_ACCEPTANCE_REJECTED')
      },
      writeOutput: (value) => output.push(value),
      writeError: (value) => errorOutput.push(value),
    })

    expect(code).toBe(1)
    expect(output).toEqual([])
    expect(errorOutput.join('')).toContain(
      '"errorCode":"CURRENT_RELEASE_ACCEPTANCE_REJECTED"',
    )
    expect(errorOutput.join('')).toContain('"accepted":false')
    expect(errorOutput.join('')).not.toContain('password')
  })

  it('maps an unverified Cognito prerequisite to a stable runbook action without raw AWS output', () => {
    const raw =
      'CURRENT_RELEASE_COGNITO_RESOURCE_UNVERIFIED raw-secret-output'
    const mapped = mapCurrentReleasePreflightError(
      new Error('CURRENT_RELEASE_COGNITO_RESOURCE_UNVERIFIED'),
    )

    expect(mapped.message).toBe(
      'CURRENT_RELEASE_COGNITO_PREREQUISITE_MISSING:SEE_RUNBOOK',
    )
    expect(mapped.message).not.toContain(raw)
  })

  it('uses the real cleanup implementation without conservative placeholders', () => {
    const source = readFileSync(
      'scripts/current-release-acceptance.ts',
      'utf8',
    )

    expect(source).toContain('cleanupCurrentRelease')
    expect(source).toContain('verifyRunS3Empty')
    expect(source).not.toContain('databaseEmpty: false')
    expect(source).not.toContain('s3VersionsRemaining:')
    expect(source).not.toContain('Tasks 8-9 replace')
  })
})
