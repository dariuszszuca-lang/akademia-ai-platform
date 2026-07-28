import type {
  SyntheticCleanupRegistry,
} from './cleanup-registry'
import {
  createSyntheticCleanupRegistry,
} from './cleanup-registry'
import { syntheticCorpus } from './manifest'
import {
  createSafeReport,
  type SafeSyntheticAcceptanceReport,
} from './report'
import {
  scoreSyntheticRun,
  type SyntheticJobObservation,
  type SyntheticObservation,
} from './scorer'

export const PRODUCTION_SYNTHETIC_ACCOUNT = '261965598943'
export const PRODUCTION_SYNTHETIC_PROFILE = 'akademia-ai'
export const PRODUCTION_SYNTHETIC_REGION = 'eu-central-1'
export const PRODUCTION_SYNTHETIC_BASE_URL =
  'https://akademia-ai-platform.vercel.app'
export const PRODUCTION_SYNTHETIC_MAX_COST_USD = 3
const EXPECTED_CALLER_SUFFIX =
  'user/akademia-wojtka-admin-darek'

export type ProductionSyntheticOptions = {
  allowProductionSynthetic: boolean
  profile: string
  region: string
  baseUrl: string
  maxCostUsd: number
  workspaceRoot: string
}

type CorpusResult = {
  observations: SyntheticObservation[]
  jobs: SyntheticJobObservation[]
  modelIds: string[]
}

type ExecuteCorpusContext = {
  registry: SyntheticCleanupRegistry
  saveRegistry: () => Promise<void>
  cookie: string
  maxCostUsd: number
}

export type ProductionSyntheticDependencies = {
  now: () => Date
  createRunId: (now: Date) => string
  createPassword: () => string
  aws: {
    getConfiguredRegion: (profile: string) => Promise<string>
    getCallerIdentity: (
      profile: string,
      region: string,
    ) => Promise<{ Account: string; Arn: string }>
    checkDlq: () => Promise<number>
    checkAlarms: () => Promise<number>
    createCognitoUser: (
      username: string,
      password: string,
    ) => Promise<{ cognitoSub: string }>
    authenticateCognitoUser: (
      username: string,
      password: string,
    ) => Promise<{ accessToken: string }>
    deleteCognitoUser: (username: string) => Promise<void>
    verifyS3Empty: (organizationPrefix: string) => Promise<number>
    purgeRegisteredObjects: (
      registry: SyntheticCleanupRegistry,
    ) => Promise<void>
  }
  http: {
    createSession: (
      accessToken: string,
    ) => Promise<{ cookie: string; userId: string }>
    executeCorpus: (
      context: ExecuteCorpusContext,
    ) => Promise<CorpusResult>
    deleteAccount: (cookie: string, userId: string) => Promise<void>
    verifyAccountAbsent: (cookie: string) => Promise<boolean>
  }
  registry: {
    save: (registry: SyntheticCleanupRegistry) => Promise<void>
    remove: (runId: string) => Promise<void>
  }
  writeReport: (
    report: SafeSyntheticAcceptanceReport,
  ) => Promise<void>
}

export async function runProductionSynthetic(
  options: ProductionSyntheticOptions,
  dependencies: ProductionSyntheticDependencies,
) {
  await runPreflight(options, dependencies)

  const startedAt = dependencies.now()
  const runId = dependencies.createRunId(startedAt)
  const registry = createSyntheticCleanupRegistry({
    runId,
    startedAt: startedAt.toISOString(),
  })
  const password = dependencies.createPassword()
  let cookie: string | null = null
  let userId: string | null = null
  let result: CorpusResult | null = null
  let runError: unknown

  await dependencies.registry.save(registry)
  try {
    const created = await dependencies.aws.createCognitoUser(
      registry.username,
      password,
    )
    registry.cognitoSub = created.cognitoSub
    await dependencies.registry.save(registry)

    const authenticated =
      await dependencies.aws.authenticateCognitoUser(
        registry.username,
        password,
      )
    const session = await dependencies.http.createSession(
      authenticated.accessToken,
    )
    cookie = session.cookie
    userId = session.userId
    if (session.userId !== registry.cognitoSub) {
      throw new Error('SYNTHETIC_SESSION_SUBJECT_MISMATCH')
    }

    result = await dependencies.http.executeCorpus({
      registry,
      saveRegistry: () => dependencies.registry.save(registry),
      cookie,
      maxCostUsd: options.maxCostUsd,
    })
  } catch (error) {
    runError = error
  }

  const cleanup = await cleanupRun({
    dependencies,
    registry,
    cookie,
    userId,
  })

  if (runError) throw runError
  if (!result) throw new Error('SYNTHETIC_RESULT_MISSING')

  const score = scoreSyntheticRun({
    manifest: syntheticCorpus,
    observations: result.observations,
    jobs: result.jobs,
  })
  const report = createSafeReport({
    contractVersion: 'synthetic-acceptance-v1',
    runId,
    mode: 'production-synthetic',
    startedAt: startedAt.toISOString(),
    completedAt: dependencies.now().toISOString(),
    caseCodes: syntheticCorpus.cases.map((item) => item.code),
    score,
    modelIds: result.modelIds,
    cleanup,
  })
  await dependencies.writeReport(report)
  return report
}

async function runPreflight(
  options: ProductionSyntheticOptions,
  dependencies: ProductionSyntheticDependencies,
) {
  if (!options.allowProductionSynthetic) {
    throw new Error('PRODUCTION_SYNTHETIC_NOT_ALLOWED')
  }
  if (options.profile !== PRODUCTION_SYNTHETIC_PROFILE) {
    throw new Error('REFUSING_AWS_PROFILE')
  }
  if (options.region !== PRODUCTION_SYNTHETIC_REGION) {
    throw new Error('REFUSING_AWS_REGION')
  }
  if (options.baseUrl !== PRODUCTION_SYNTHETIC_BASE_URL) {
    throw new Error('REFUSING_PRODUCTION_URL')
  }
  if (
    !Number.isFinite(options.maxCostUsd) ||
    options.maxCostUsd <= 0 ||
    options.maxCostUsd > PRODUCTION_SYNTHETIC_MAX_COST_USD
  ) {
    throw new Error('INVALID_SYNTHETIC_COST_LIMIT')
  }

  const configuredRegion =
    await dependencies.aws.getConfiguredRegion(options.profile)
  if (configuredRegion !== PRODUCTION_SYNTHETIC_REGION) {
    throw new Error('REFUSING_AWS_REGION')
  }
  const identity = await dependencies.aws.getCallerIdentity(
    options.profile,
    options.region,
  )
  if (identity.Account !== PRODUCTION_SYNTHETIC_ACCOUNT) {
    throw new Error('REFUSING_AWS_ACCOUNT')
  }
  if (!identity.Arn.endsWith(EXPECTED_CALLER_SUFFIX)) {
    throw new Error('REFUSING_AWS_CALLER')
  }
  if ((await dependencies.aws.checkDlq()) !== 0) {
    throw new Error('SYNTHETIC_DLQ_NOT_EMPTY')
  }
  if ((await dependencies.aws.checkAlarms()) !== 0) {
    throw new Error('SYNTHETIC_ALARMS_NOT_OK')
  }
}

async function cleanupRun({
  dependencies,
  registry,
  cookie,
  userId,
}: {
  dependencies: ProductionSyntheticDependencies
  registry: SyntheticCleanupRegistry
  cookie: string | null
  userId: string | null
}) {
  const errors: string[] = []
  let databaseEmpty = false
  let s3VersionsRemaining = 0

  try {
    await dependencies.registry.save(registry)
  } catch {
    errors.push('registry')
  }
  if (cookie && userId) {
    try {
      await dependencies.http.deleteAccount(cookie, userId)
      databaseEmpty = await dependencies.http.verifyAccountAbsent(cookie)
    } catch {
      errors.push('account')
    }
  }
  try {
    await dependencies.aws.deleteCognitoUser(registry.username)
  } catch {
    errors.push('cognito')
  }
  if (registry.organizationPrefix) {
    try {
      s3VersionsRemaining = await dependencies.aws.verifyS3Empty(
        registry.organizationPrefix,
      )
      if (s3VersionsRemaining > 0) {
        await dependencies.aws.purgeRegisteredObjects(registry)
        s3VersionsRemaining = await dependencies.aws.verifyS3Empty(
          registry.organizationPrefix,
        )
      }
      if (s3VersionsRemaining > 0) errors.push('s3')
    } catch {
      errors.push('s3')
    }
  }

  const dlqMessagesVisible = await safeCount(
    dependencies.aws.checkDlq,
    errors,
    'dlq',
  )
  const alarmsNotOk = await safeCount(
    dependencies.aws.checkAlarms,
    errors,
    'alarms',
  )

  if (errors.length > 0) {
    throw new Error(
      `SYNTHETIC_CLEANUP_FAILED:${[...new Set(errors)].join(',')}`,
    )
  }
  await dependencies.registry.remove(registry.runId)
  return {
    databaseEmpty,
    cognitoUserAbsent: true,
    s3VersionsRemaining,
    dlqMessagesVisible,
    alarmsNotOk,
  }
}

async function safeCount(
  read: () => Promise<number>,
  errors: string[],
  label: string,
) {
  try {
    return await read()
  } catch {
    errors.push(label)
    return 1
  }
}
