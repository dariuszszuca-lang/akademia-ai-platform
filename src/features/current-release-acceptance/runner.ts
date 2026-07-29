import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import {
  createSyntheticCleanupRegistry,
  type SyntheticCleanupRegistry,
} from '../synthetic-acceptance/cleanup-registry'
import {
  createAcceptanceCostGuard,
  CURRENT_RELEASE_COST_STOP_USD,
  CURRENT_RELEASE_MAX_COST_USD,
  currentReleaseRunIdSchema,
  currentReleaseScenarioResultsSchema,
  type ScenarioResult,
} from './domain'
import {
  createCurrentReleaseReport,
  renderCurrentReleaseReportMarkdown,
  serializeCurrentReleaseReport,
  type CurrentReleaseReport,
} from './report'

export const CURRENT_RELEASE_PRODUCTION_URL =
  'https://akademia-ai-platform.vercel.app'
export const CURRENT_RELEASE_AWS_ACCOUNT = '261965598943'
export const CURRENT_RELEASE_AWS_PROFILE = 'akademia-ai'
export const CURRENT_RELEASE_AWS_REGION = 'eu-central-1'
export const CURRENT_RELEASE_AWS_CALLER_ARN =
  'arn:aws:iam::261965598943:user/akademia-wojtka-admin-darek'

export const CURRENT_RELEASE_COST_RESERVATIONS = {
  onboardingGenerationUsd: 0.06,
  onboardingGenerationCalls: 7,
  agentCallUsd: 0.08,
  agentCalls: 8,
  sourcePipelineUsd: 0.25,
  stopBeforeUsd: CURRENT_RELEASE_COST_STOP_USD,
  maxUsd: CURRENT_RELEASE_MAX_COST_USD,
} as const

export type CurrentReleaseRunnerOptions = {
  allowProduction: boolean
  baseUrl: string
  maxCostUsd: number
  profile: string
  region: string
  adminPassword: string | undefined
  workspaceRoot: string
}

export type CurrentReleaseCleanup = {
  databaseEmpty: boolean
  cognitoUsersAbsent: boolean
  kvKeysAbsent: boolean
  s3VersionsRemaining: number
  adminStateRestored: boolean
  dlqMessagesVisible: number
  alarmsNotOk: number
}

export type BrowserExecutionResult = {
  scenarios: ScenarioResult[]
  modelIds: string[]
  usage: {
    onboardingGenerationCalls: number
    agentCalls: number
    observedPipelineCostUsd: number
  }
  registryUpdate?: BrowserRegistryUpdate
}

export type BrowserRegistryUpdate = {
  releaseUsers: SyntheticCleanupRegistry['releaseUsers']
  organizationId: string | null
  organizationPrefix: string | null
  projectIds: string[]
  sourceIds: string[]
  storageKeys: string[]
  kvKeys: string[]
  adminAgentState: SyntheticCleanupRegistry['adminAgentState']
}

export type BrowserExecutionInput = {
  runId: string
  baseUrl: string
  childEnv: Record<string, string>
  costReservations: typeof CURRENT_RELEASE_COST_RESERVATIONS
  resultPath: string
  registry: SyntheticCleanupRegistry
}

export type CurrentReleaseRunnerDependencies = {
  now: () => Date
  createRunId: (now: Date) => string
  createPassword: () => string
  getConfiguredRegion: (profile: string) => Promise<string>
  getCallerIdentity: (
    profile: string,
    region: string,
  ) => Promise<{ Account: string; Arn: string }>
  checkDlq: () => Promise<number>
  checkAlarms: () => Promise<number>
  saveRegistry: (
    registry: SyntheticCleanupRegistry,
  ) => Promise<void>
  removeRegistry: (runId: string) => Promise<void>
  executeBrowser: (
    input: BrowserExecutionInput,
  ) => Promise<BrowserExecutionResult>
  cleanup: (
    registry: SyntheticCleanupRegistry,
  ) => Promise<CurrentReleaseCleanup>
  getCommitSha: () => Promise<string>
  getDeploymentId: () => Promise<string>
  writeReport: (report: CurrentReleaseReport) => Promise<void>
}

const uuidSchema = z.string().uuid()
const cognitoSubjectSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )

const browserRegistryUpdateSchema = z
  .object({
    releaseUsers: z
      .array(
        z
          .object({
            role: z.enum(['a', 'b']),
            username: z.string().max(180),
            cognitoSub: cognitoSubjectSchema.nullable(),
          })
          .strict(),
      )
      .length(2),
    organizationId: uuidSchema.nullable(),
    organizationPrefix: z.string().max(240).nullable(),
    projectIds: z.array(uuidSchema).max(20),
    sourceIds: z.array(uuidSchema).max(20),
    storageKeys: z.array(z.string().min(1).max(1024)).max(40),
    kvKeys: z.array(z.string().min(1).max(512)).max(20),
    adminAgentState: z
      .object({
        agentId: z
          .string()
          .regex(/^[a-z][a-z0-9-]*$/)
          .max(80),
        enabled: z.boolean(),
      })
      .strict()
      .nullable(),
  })
  .strict()

const browserExecutionResultSchema = z
  .object({
    scenarios: currentReleaseScenarioResultsSchema,
    modelIds: z.array(z.string().min(1).max(240)).max(20),
    usage: z
      .object({
        onboardingGenerationCalls: z.number().int().nonnegative(),
        agentCalls: z.number().int().nonnegative(),
        observedPipelineCostUsd: z.number().nonnegative(),
      })
      .strict(),
    registryUpdate: browserRegistryUpdateSchema.optional(),
  })
  .strict()

export async function runCurrentReleaseAcceptance(
  options: CurrentReleaseRunnerOptions,
  dependencies: CurrentReleaseRunnerDependencies,
): Promise<CurrentReleaseReport> {
  validateLocalOptions(options)
  await runPreflight(options, dependencies)

  const startedAt = dependencies.now()
  const runId = currentReleaseRunIdSchema.parse(
    dependencies.createRunId(startedAt),
  )
  const passwordA = dependencies.createPassword()
  const passwordB = dependencies.createPassword()
  validateGeneratedPassword(passwordA)
  validateGeneratedPassword(passwordB)
  if (passwordA === passwordB) {
    throw new Error('CURRENT_RELEASE_PASSWORDS_NOT_UNIQUE')
  }

  const registry = createSyntheticCleanupRegistry({
    runId,
    startedAt: startedAt.toISOString(),
  })
  registry.releaseUsers = [
    {
      role: 'a',
      username: `synthetic-release-${runId}-a@example.invalid`,
      cognitoSub: null,
    },
    {
      role: 'b',
      username: `synthetic-release-${runId}-b@example.invalid`,
      cognitoSub: null,
    },
  ]

  const costGuard = createAcceptanceCostGuard({
    stopBeforeUsd: Math.min(
      CURRENT_RELEASE_COST_STOP_USD,
      options.maxCostUsd,
    ),
    maxUsd: options.maxCostUsd,
  })
  reservePlannedCosts(costGuard)

  const resultPath = resolve(
    options.workspaceRoot,
    'Temp',
    'current-release-playwright',
    runId,
    'result.json',
  )
  const childEnv = {
    CURRENT_RELEASE_RUN_ID: runId,
    CURRENT_RELEASE_BASE_URL: options.baseUrl,
    CURRENT_RELEASE_USER_A: registry.releaseUsers[0]!.username,
    CURRENT_RELEASE_USER_A_PASSWORD: passwordA,
    CURRENT_RELEASE_USER_B: registry.releaseUsers[1]!.username,
    CURRENT_RELEASE_USER_B_PASSWORD: passwordB,
    ADMIN_PASSWORD: options.adminPassword!.trim(),
    AWS_PROFILE: options.profile,
    AWS_REGION: options.region,
    CURRENT_RELEASE_RESULT_PATH: resultPath,
    CURRENT_RELEASE_COST_RESERVATIONS: JSON.stringify(
      CURRENT_RELEASE_COST_RESERVATIONS,
    ),
  }

  let browserResult: BrowserExecutionResult | null = null
  let executionErrorCode: string | null = null
  let cleanup: CurrentReleaseCleanup | null = null
  let cleanupFailed = false

  try {
    await dependencies.saveRegistry(registry)
    const candidate = await dependencies.executeBrowser({
      runId,
      baseUrl: options.baseUrl,
      childEnv,
      costReservations: CURRENT_RELEASE_COST_RESERVATIONS,
      resultPath,
      registry,
    })
    const parsedCandidate =
      browserExecutionResultSchema.safeParse(candidate)
    if (!parsedCandidate.success) {
      executionErrorCode =
        'CURRENT_RELEASE_BROWSER_RESULT_INVALID'
    } else {
      browserResult = parsedCandidate.data
      if (browserResult.registryUpdate) {
        applyBrowserRegistryUpdate(
          registry,
          browserResult.registryUpdate,
        )
        await dependencies.saveRegistry(registry)
      }
    }
  } catch {
    executionErrorCode ??= 'CURRENT_RELEASE_BROWSER_FAILED'
  } finally {
    try {
      cleanup = await dependencies.cleanup(registry)
    } catch {
      cleanupFailed = true
    }
  }

  if (executionErrorCode) {
    throw new Error(executionErrorCode)
  }
  if (cleanupFailed || !cleanup) {
    throw new Error('CURRENT_RELEASE_CLEANUP_FAILED')
  }

  const parsedBrowser = browserExecutionResultSchema.safeParse(
    browserResult,
  )
  if (!parsedBrowser.success) {
    throw new Error('CURRENT_RELEASE_BROWSER_RESULT_INVALID')
  }
  validateBrowserUsage(parsedBrowser.data)
  costGuard.recordObservedPipelineCost(
    parsedBrowser.data.usage.observedPipelineCostUsd,
  )

  const estimatedAnthropicCostUsd =
    CURRENT_RELEASE_COST_RESERVATIONS.onboardingGenerationUsd *
      CURRENT_RELEASE_COST_RESERVATIONS.onboardingGenerationCalls +
    CURRENT_RELEASE_COST_RESERVATIONS.agentCallUsd *
      CURRENT_RELEASE_COST_RESERVATIONS.agentCalls
  const observedPipelineCostUsd =
    costGuard.observedPipelineCostUsd()
  const providerCostUsd = roundUsd(
    estimatedAnthropicCostUsd + observedPipelineCostUsd,
  )
  const cleanupPassed = cleanupChecksPass(cleanup)
  const report = createCurrentReleaseReport({
    contractVersion: 'current-release-acceptance-v1',
    runId,
    baseUrl: options.baseUrl,
    commitSha: await dependencies.getCommitSha(),
    deploymentId: await dependencies.getDeploymentId(),
    startedAt: startedAt.toISOString(),
    completedAt: dependencies.now().toISOString(),
    scenarios: parsedBrowser.data.scenarios,
    modelIds: parsedBrowser.data.modelIds,
    estimatedAnthropicCostUsd: roundUsd(
      estimatedAnthropicCostUsd,
    ),
    observedPipelineCostUsd,
    providerCostUsd,
    cleanup,
    accepted:
      cleanupPassed &&
      parsedBrowser.data.scenarios.every(
        (scenario) => scenario.status === 'passed',
      ),
  })

  try {
    await dependencies.writeReport(report)
  } catch {
    throw new Error('CURRENT_RELEASE_REPORT_WRITE_FAILED')
  }
  if (report.accepted) {
    await dependencies.removeRegistry(runId)
  }
  return report
}

export function createDefaultBrowserExecutor(
  workspaceRoot: string,
): CurrentReleaseRunnerDependencies['executeBrowser'] {
  return async (input) => {
    await mkdir(resolve(input.resultPath, '..'), {
      recursive: true,
      mode: 0o700,
    })
    await rm(input.resultPath, { force: true })
    try {
      execFileSync(
        'npx',
        [
          'playwright',
          'test',
          '--config',
          'playwright.config.ts',
          '--workers=1',
        ],
        {
          cwd: workspaceRoot,
          env: { ...process.env, ...input.childEnv },
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 45 * 60_000,
          maxBuffer: 10 * 1024 * 1024,
        },
      )
    } catch {
      throw new Error('CURRENT_RELEASE_BROWSER_FAILED')
    }

    let raw: string
    try {
      raw = await readFile(input.resultPath, 'utf8')
    } catch {
      throw new Error('CURRENT_RELEASE_BROWSER_RESULT_MISSING')
    }
    try {
      return browserExecutionResultSchema.parse(JSON.parse(raw))
    } catch {
      throw new Error('CURRENT_RELEASE_BROWSER_RESULT_INVALID')
    }
  }
}

export async function saveCurrentReleaseRegistry(
  workspaceRoot: string,
  registry: SyntheticCleanupRegistry,
): Promise<void> {
  const directory = resolve(
    workspaceRoot,
    'reports',
    'current-release-acceptance',
  )
  const path = join(directory, `${registry.runId}.run.json`)
  const temporaryPath = `${path}.${process.pid}.tmp`
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await writeFile(
    temporaryPath,
    `${JSON.stringify(registry, null, 2)}\n`,
    { mode: 0o600 },
  )
  await rename(temporaryPath, path)
}

export async function removeCurrentReleaseRegistry(
  workspaceRoot: string,
  runId: string,
): Promise<void> {
  const parsedRunId = currentReleaseRunIdSchema.parse(runId)
  await rm(
    resolve(
      workspaceRoot,
      'reports',
      'current-release-acceptance',
      `${parsedRunId}.run.json`,
    ),
    { force: true },
  )
}

export async function writeCurrentReleaseReport(
  workspaceRoot: string,
  report: CurrentReleaseReport,
): Promise<void> {
  const directory = resolve(
    workspaceRoot,
    'reports',
    'current-release-acceptance',
  )
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await Promise.all([
    writeFile(
      join(directory, `${report.runId}.json`),
      serializeCurrentReleaseReport(report),
      { mode: 0o600 },
    ),
    writeFile(
      join(directory, `${report.runId}.md`),
      `${renderCurrentReleaseReportMarkdown(report)}\n`,
      { mode: 0o600 },
    ),
  ])
}

export function createCurrentReleaseRunId(now: Date): string {
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
  return currentReleaseRunIdSchema.parse(
    `syn-${timestamp}-${randomBytes(4).toString('hex')}`,
  )
}

export function createCurrentReleasePassword(): string {
  return `Aa1!${randomBytes(32).toString('base64url')}`
}

async function runPreflight(
  options: CurrentReleaseRunnerOptions,
  dependencies: CurrentReleaseRunnerDependencies,
): Promise<void> {
  const configuredRegion =
    await dependencies.getConfiguredRegion(options.profile)
  if (configuredRegion.trim() !== CURRENT_RELEASE_AWS_REGION) {
    throw new Error('CURRENT_RELEASE_AWS_REGION_INVALID')
  }
  const identity = await dependencies.getCallerIdentity(
    options.profile,
    options.region,
  )
  if (identity.Account !== CURRENT_RELEASE_AWS_ACCOUNT) {
    throw new Error('CURRENT_RELEASE_AWS_ACCOUNT_INVALID')
  }
  if (identity.Arn !== CURRENT_RELEASE_AWS_CALLER_ARN) {
    throw new Error('CURRENT_RELEASE_AWS_CALLER_INVALID')
  }
  const dlqMessages = await dependencies.checkDlq()
  if (!Number.isInteger(dlqMessages) || dlqMessages !== 0) {
    throw new Error('CURRENT_RELEASE_DLQ_NOT_EMPTY')
  }
  const alarmsNotOk = await dependencies.checkAlarms()
  if (!Number.isInteger(alarmsNotOk) || alarmsNotOk !== 0) {
    throw new Error('CURRENT_RELEASE_ALARMS_NOT_OK')
  }
}

function validateLocalOptions(
  options: CurrentReleaseRunnerOptions,
): void {
  if (!options.allowProduction) {
    throw new Error('CURRENT_RELEASE_PRODUCTION_NOT_ALLOWED')
  }
  if (options.baseUrl !== CURRENT_RELEASE_PRODUCTION_URL) {
    throw new Error('CURRENT_RELEASE_PRODUCTION_URL_INVALID')
  }
  if (options.profile !== CURRENT_RELEASE_AWS_PROFILE) {
    throw new Error('CURRENT_RELEASE_AWS_PROFILE_INVALID')
  }
  if (options.region !== CURRENT_RELEASE_AWS_REGION) {
    throw new Error('CURRENT_RELEASE_AWS_REGION_INVALID')
  }
  if (
    !Number.isFinite(options.maxCostUsd) ||
    options.maxCostUsd <= 0 ||
    options.maxCostUsd > CURRENT_RELEASE_MAX_COST_USD
  ) {
    throw new Error('CURRENT_RELEASE_COST_LIMIT_INVALID')
  }
  if (!options.adminPassword?.trim()) {
    throw new Error('CURRENT_RELEASE_ADMIN_PASSWORD_MISSING')
  }
}

function validateGeneratedPassword(password: string): void {
  if (
    password.length < 20 ||
    password.length > 200 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password) ||
    /\s/.test(password)
  ) {
    throw new Error('CURRENT_RELEASE_PASSWORD_INVALID')
  }
}

function reservePlannedCosts(
  costGuard: ReturnType<typeof createAcceptanceCostGuard>,
): void {
  for (
    let index = 0;
    index <
    CURRENT_RELEASE_COST_RESERVATIONS.onboardingGenerationCalls;
    index += 1
  ) {
    costGuard.reserve(
      `onboarding.${index + 1}`,
      CURRENT_RELEASE_COST_RESERVATIONS.onboardingGenerationUsd,
    )
  }
  for (
    let index = 0;
    index < CURRENT_RELEASE_COST_RESERVATIONS.agentCalls;
    index += 1
  ) {
    costGuard.reserve(
      `agent.${index + 1}`,
      CURRENT_RELEASE_COST_RESERVATIONS.agentCallUsd,
    )
  }
  costGuard.reserve(
    'pipeline',
    CURRENT_RELEASE_COST_RESERVATIONS.sourcePipelineUsd,
  )
}

function validateBrowserUsage(result: BrowserExecutionResult): void {
  if (
    result.usage.onboardingGenerationCalls >
      CURRENT_RELEASE_COST_RESERVATIONS.onboardingGenerationCalls ||
    result.usage.agentCalls >
      CURRENT_RELEASE_COST_RESERVATIONS.agentCalls
  ) {
    throw new Error('CURRENT_RELEASE_BROWSER_USAGE_INVALID')
  }
}

function applyBrowserRegistryUpdate(
  registry: SyntheticCleanupRegistry,
  update: BrowserRegistryUpdate,
): void {
  const parsed = browserRegistryUpdateSchema.safeParse(update)
  if (!parsed.success) {
    throw new Error('CURRENT_RELEASE_REGISTRY_UPDATE_INVALID')
  }
  const expectedUsers = ['a', 'b'].map((role) => ({
    role,
    username:
      `synthetic-release-${registry.runId}-${role}@example.invalid`,
  }))
  if (
    parsed.data.releaseUsers.some(
      (user, index) =>
        user.role !== expectedUsers[index]!.role ||
        user.username !== expectedUsers[index]!.username,
    )
  ) {
    throw new Error('CURRENT_RELEASE_REGISTRY_UPDATE_INVALID')
  }
  const expectedPrefix = parsed.data.organizationId
    ? `originals/organizations/${parsed.data.organizationId}/`
    : null
  if (
    parsed.data.organizationPrefix !== expectedPrefix ||
    (expectedPrefix !== null &&
      parsed.data.storageKeys.some(
        (storageKey) => !storageKey.startsWith(expectedPrefix),
      ))
  ) {
    throw new Error('CURRENT_RELEASE_REGISTRY_UPDATE_INVALID')
  }
  const subjects = parsed.data.releaseUsers.flatMap((user) =>
    user.cognitoSub ? [user.cognitoSub] : [],
  )
  const allowedKvKeys = new Set(
    subjects.flatMap((subject) =>
      [
        'profil',
        'persona-buyer',
        'persona-seller',
        'onboarding',
        'subscription',
      ].map((suffix) => `user:${subject}:${suffix}`),
    ),
  )
  if (
    parsed.data.kvKeys.some((key) => !allowedKvKeys.has(key)) ||
    new Set(parsed.data.kvKeys).size !== parsed.data.kvKeys.length ||
    new Set(parsed.data.projectIds).size !==
      parsed.data.projectIds.length ||
    new Set(parsed.data.sourceIds).size !==
      parsed.data.sourceIds.length ||
    new Set(parsed.data.storageKeys).size !==
      parsed.data.storageKeys.length
  ) {
    throw new Error('CURRENT_RELEASE_REGISTRY_UPDATE_INVALID')
  }

  Object.assign(registry, parsed.data)
}

function cleanupChecksPass(cleanup: CurrentReleaseCleanup): boolean {
  return (
    cleanup.databaseEmpty &&
    cleanup.cognitoUsersAbsent &&
    cleanup.kvKeysAbsent &&
    cleanup.s3VersionsRemaining === 0 &&
    cleanup.adminStateRestored &&
    cleanup.dlqMessagesVisible === 0 &&
    cleanup.alarmsNotOk === 0
  )
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}
