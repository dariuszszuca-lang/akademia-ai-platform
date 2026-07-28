#!/usr/bin/env node
import { relative } from 'node:path'
import { runLocalSyntheticAcceptance } from '../src/features/synthetic-acceptance/local-runner'

async function main() {
  const mode = process.argv[2]
  if (mode === 'production-synthetic') {
    throw new Error('PRODUCTION_SYNTHETIC_RUNNER_NOT_IMPLEMENTED')
  }
  if (mode !== 'local') {
    throw new Error('SYNTHETIC_ACCEPTANCE_MODE_INVALID')
  }

  const result = await runLocalSyntheticAcceptance()
  process.stdout.write(
    `${JSON.stringify({
      runId: result.report.runId,
      accepted: result.report.score.accepted,
      cases: result.report.caseCodes.length,
      materials: result.generatedMaterialCount,
      referenceFactsMatched:
        result.report.score.referenceFactsMatched,
      referenceFactsTotal: result.report.score.referenceFactsTotal,
      report: relative(process.cwd(), result.reportPath),
    })}\n`,
  )

  if (!result.report.score.accepted) process.exitCode = 1
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : 'SYNTHETIC_ACCEPTANCE_UNKNOWN_ERROR'
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
