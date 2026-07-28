#!/usr/bin/env node
import { relative } from 'node:path'
import { runLocalSyntheticAcceptance } from '../src/features/synthetic-acceptance/local-runner'
import { createDefaultProductionSyntheticDependencies } from '../src/features/synthetic-acceptance/production-dependencies'
import {
  PRODUCTION_SYNTHETIC_REGION,
  runProductionSynthetic,
} from '../src/features/synthetic-acceptance/production-runner'

async function main() {
  const mode = process.argv[2]
  if (mode === 'production-synthetic') {
    const parsed = parseProductionArguments(process.argv.slice(3))
    const options = {
      allowProductionSynthetic: parsed.allowProductionSynthetic,
      profile: process.env.AWS_PROFILE ?? '',
      region:
        process.env.AWS_REGION ?? PRODUCTION_SYNTHETIC_REGION,
      baseUrl: parsed.baseUrl,
      maxCostUsd: parsed.maxCostUsd,
      workspaceRoot: process.cwd(),
    }
    const report = await runProductionSynthetic(
      options,
      createDefaultProductionSyntheticDependencies(options),
    )
    process.stdout.write(
      `${JSON.stringify({
        runId: report.runId,
        accepted: report.score.accepted,
        cases: report.caseCodes.length,
        referenceFactsMatched: report.score.referenceFactsMatched,
        referenceFactsTotal: report.score.referenceFactsTotal,
        providerCostUsd: report.score.providerCostUsd,
        s3VersionsRemaining: report.cleanup.s3VersionsRemaining,
        dlqMessagesVisible: report.cleanup.dlqMessagesVisible,
        alarmsNotOk: report.cleanup.alarmsNotOk,
      })}\n`,
    )
    if (!report.score.accepted) process.exitCode = 1
    return
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

function parseProductionArguments(args: string[]) {
  let allowProductionSynthetic = false
  let baseUrl = ''
  let maxCostUsd = Number.NaN
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--allow-production-synthetic') {
      allowProductionSynthetic = true
    } else if (argument === '--base-url') {
      baseUrl = args[index + 1] ?? ''
      index += 1
    } else if (argument === '--max-cost-usd') {
      maxCostUsd = Number(args[index + 1])
      index += 1
    } else {
      throw new Error('SYNTHETIC_ACCEPTANCE_ARGUMENT_INVALID')
    }
  }
  return { allowProductionSynthetic, baseUrl, maxCostUsd }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : 'SYNTHETIC_ACCEPTANCE_UNKNOWN_ERROR'
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
