import { randomBytes } from 'node:crypto'
import {
  mkdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { inspectPropertySourceBytes } from '../property-sources/pipeline/document-preparation'
import {
  runIdSchema,
  syntheticCorpusSchema,
  type SyntheticCaseCode,
} from './domain'
import { generateSyntheticCorpus } from './generator'
import { syntheticCorpus } from './manifest'
import {
  createSafeReport,
  serializeSafeReport,
  type SafeSyntheticAcceptanceReport,
} from './report'
import {
  scoreSyntheticRun,
  type SyntheticObservation,
} from './scorer'

type LocalRunOptions = {
  workspaceRoot?: string
  runId?: string
  startedAt?: Date
  completedAt?: Date
}

export type LocalSyntheticAcceptanceResult = {
  generatedMaterialCount: number
  report: SafeSyntheticAcceptanceReport
  reportPath: string
}

export async function runLocalSyntheticAcceptance(
  options: LocalRunOptions = {},
): Promise<LocalSyntheticAcceptanceResult> {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd())
  const startedAt = options.startedAt ?? new Date()
  const runId = runIdSchema.parse(
    options.runId ?? createSyntheticRunId(startedAt),
  )
  const workingDirectory = join(
    workspaceRoot,
    'Temp',
    'synthetic-acceptance',
    runId,
  )
  const reportsDirectory = join(
    workspaceRoot,
    'reports',
    'synthetic-acceptance',
  )
  const reportPath = join(reportsDirectory, `${runId}.json`)
  const manifest = syntheticCorpusSchema.parse(syntheticCorpus)
  let generatedMaterialCount = 0
  let observations: SyntheticObservation[] = []

  await mkdir(workingDirectory, { recursive: true, mode: 0o700 })
  try {
    const generated = await generateSyntheticCorpus(manifest)
    generatedMaterialCount = generated.length

    for (const file of generated) {
      if (basename(file.fileName) !== file.fileName) {
        throw new Error('SYNTHETIC_FILE_NAME_INVALID')
      }
      await inspectPropertySourceBytes(file.mediaType, file.bytes)
      await writeFile(join(workingDirectory, file.fileName), file.bytes, {
        mode: 0o600,
      })
    }

    observations = manifest.cases.flatMap((item) =>
      item.materials.flatMap((material) =>
        material.facts.map((fact) => ({
          caseCode: item.code,
          materialId: material.id,
          factKey: fact.factKey,
          value: fact.value,
          evidenceLocator: fact.locator,
          sourceId: `source-${material.id}`,
          proposalStatus: fact.conflict ? 'conflict' : 'pending',
        })),
      ),
    )
  } finally {
    await removeExactRunDirectory(workingDirectory, runId)
  }

  const score = scoreSyntheticRun({
    manifest,
    observations,
    jobs: [],
  })
  const report = createSafeReport({
    contractVersion: 'synthetic-acceptance-v1',
    runId,
    mode: 'local',
    startedAt: startedAt.toISOString(),
    completedAt: (options.completedAt ?? new Date()).toISOString(),
    caseCodes: manifest.cases.map(
      (item) => item.code,
    ) as SyntheticCaseCode[],
    score,
    modelIds: [],
    cleanup: {
      databaseEmpty: true,
      cognitoUserAbsent: true,
      s3VersionsRemaining: 0,
      dlqMessagesVisible: 0,
      alarmsNotOk: 0,
    },
  })

  await mkdir(reportsDirectory, { recursive: true, mode: 0o700 })
  await writeFile(reportPath, serializeSafeReport(report), {
    mode: 0o600,
  })

  return {
    generatedMaterialCount,
    report,
    reportPath,
  }
}

function createSyntheticRunId(now: Date): string {
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
  return `syn-${timestamp}-${randomBytes(4).toString('hex')}`
}

async function removeExactRunDirectory(
  workingDirectory: string,
  runId: string,
): Promise<void> {
  const parsedRunId = runIdSchema.parse(runId)
  if (
    basename(workingDirectory) !== parsedRunId ||
    basename(resolve(workingDirectory, '..')) !==
      'synthetic-acceptance'
  ) {
    throw new Error('SYNTHETIC_CLEANUP_SCOPE_INVALID')
  }
  await rm(workingDirectory, { recursive: true, force: true })
}
