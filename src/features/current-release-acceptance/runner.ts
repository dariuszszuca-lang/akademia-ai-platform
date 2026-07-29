import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { z } from 'zod'
import {
  getCurrentReleasePaths,
  prepareCurrentReleaseResultPath,
  readCurrentReleaseResult,
  readCurrentReleaseJournal,
  removeCurrentReleaseJournal,
  writeCurrentReleaseReportArtifacts,
  writeCurrentReleaseJournal,
  type CurrentReleasePaths,
} from '../../../e2e/current-release/journal'
import {
  writePlaywrightGuardMarker,
} from '../../../e2e/current-release/guard'
import {
  createSyntheticCleanupRegistry,
  type SyntheticCleanupRegistry,
} from '../synthetic-acceptance/cleanup-registry'
import {
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
    sourcePipelineCalls?: number
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
  registryPath: string
  paths: CurrentReleasePaths
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
  loadRegistry: (
    runId: string,
  ) => Promise<SyntheticCleanupRegistry | null>
  removeRegistry: (runId: string) => Promise<void>
  createGuardNonce: () => string
  prepareGuard: (input: {
    paths: CurrentReleasePaths
    runId: string
    nonce: string
  }) => Promise<void>
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
        sourcePipelineCalls: z
          .number()
          .int()
          .min(0)
          .max(1)
          .default(1),
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
  let activeRegistry = registry

  const paths = getCurrentReleasePaths(options.workspaceRoot, runId)
  const resultPath = paths.resultPath
  const guardNonce = dependencies.createGuardNonce()
  const childBudget = {
    maxUsd: options.maxCostUsd,
    stopBeforeUsd: Math.min(1.5, options.maxCostUsd),
    unitCosts: {
      onboardingGenerationUsd:
        CURRENT_RELEASE_COST_RESERVATIONS.onboardingGenerationUsd,
      agentCallUsd:
        CURRENT_RELEASE_COST_RESERVATIONS.agentCallUsd,
      sourcePipelineUsd:
        CURRENT_RELEASE_COST_RESERVATIONS.sourcePipelineUsd,
    },
  }
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
    CURRENT_RELEASE_REGISTRY_PATH: paths.registryPath,
    CURRENT_RELEASE_GUARD_MARKER_PATH: paths.guardMarkerPath,
    CURRENT_RELEASE_WORKSPACE_ROOT: paths.workspaceRoot,
    CURRENT_RELEASE_RUNNER_GUARD: guardNonce,
    CURRENT_RELEASE_BUDGET: JSON.stringify(childBudget),
  }

  let browserResult: BrowserExecutionResult | null = null
  let executionErrorCode: string | null = null
  let cleanup: CurrentReleaseCleanup | null = null
  let cleanupFailed = false

  try {
    await dependencies.saveRegistry(activeRegistry)
    await dependencies.prepareGuard({
      paths,
      runId,
      nonce: guardNonce,
    })
    const candidate = await dependencies.executeBrowser({
      runId,
      baseUrl: options.baseUrl,
      childEnv,
      costReservations: CURRENT_RELEASE_COST_RESERVATIONS,
      resultPath,
      registryPath: paths.registryPath,
      paths,
      registry: activeRegistry,
    })
    activeRegistry = await refreshRegistry(
      dependencies,
      runId,
      activeRegistry,
    )
    const parsedCandidate =
      browserExecutionResultSchema.safeParse(candidate)
    if (!parsedCandidate.success) {
      executionErrorCode =
        'CURRENT_RELEASE_BROWSER_RESULT_INVALID'
    } else {
      browserResult = parsedCandidate.data
      if (browserResult.registryUpdate) {
        applyBrowserRegistryUpdate(
          activeRegistry,
          browserResult.registryUpdate,
        )
        await dependencies.saveRegistry(activeRegistry)
      }
    }
  } catch {
    executionErrorCode ??= 'CURRENT_RELEASE_BROWSER_FAILED'
    try {
      activeRegistry = await refreshRegistry(
        dependencies,
        runId,
        activeRegistry,
      )
    } catch {
      executionErrorCode =
        'CURRENT_RELEASE_BROWSER_AND_JOURNAL_FAILED'
    }
  } finally {
    try {
      activeRegistry = await refreshRegistry(
        dependencies,
        runId,
        activeRegistry,
      )
      cleanup = await dependencies.cleanup(activeRegistry)
    } catch {
      cleanupFailed = true
    }
  }

  if (executionErrorCode && cleanupFailed) {
    throw new Error(
      'CURRENT_RELEASE_BROWSER_AND_CLEANUP_FAILED',
    )
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
  const estimatedAnthropicCostUsd =
    CURRENT_RELEASE_COST_RESERVATIONS.onboardingGenerationUsd *
      parsedBrowser.data.usage.onboardingGenerationCalls +
    CURRENT_RELEASE_COST_RESERVATIONS.agentCallUsd *
      parsedBrowser.data.usage.agentCalls
  const observedPipelineCostUsd =
    parsedBrowser.data.usage.observedPipelineCostUsd
  const reservedProviderCostUsd = roundUsd(
    estimatedAnthropicCostUsd +
      CURRENT_RELEASE_COST_RESERVATIONS.sourcePipelineUsd *
        parsedBrowser.data.usage.sourcePipelineCalls,
  )
  if (
    reservedProviderCostUsd > childBudget.stopBeforeUsd ||
    reservedProviderCostUsd > childBudget.maxUsd
  ) {
    throw new Error('CURRENT_RELEASE_COST_STOP')
  }
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
  } else {
    throw new Error('CURRENT_RELEASE_ACCEPTANCE_REJECTED')
  }
  return report
}

type BrowserExecuteFile = (
  executable: string,
  args: string[],
  options: {
    cwd: string
    env: NodeJS.ProcessEnv
    encoding: 'utf8'
    stdio: ['ignore', 'pipe', 'pipe']
    timeout: number
    maxBuffer: number
  },
) => string

export function createDefaultBrowserExecutor(
  workspaceRoot: string,
  runtime: {
    processEnvironment?: Record<string, string | undefined>
    executeFile?: BrowserExecuteFile
  } = {},
): CurrentReleaseRunnerDependencies['executeBrowser'] {
  const executeFile =
    runtime.executeFile ??
    (execFileSync as unknown as BrowserExecuteFile)
  return async (input) => {
    const expectedPaths = getCurrentReleasePaths(
      workspaceRoot,
      input.runId,
    )
    if (
      input.resultPath !== expectedPaths.resultPath ||
      input.registryPath !== expectedPaths.registryPath
    ) {
      throw new Error('CURRENT_RELEASE_PATH_INVALID')
    }
    await prepareCurrentReleaseResultPath(
      expectedPaths,
      input.runId,
    )
    try {
      executeFile(
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
          env: buildPlaywrightChildEnvironment(
            runtime.processEnvironment ?? process.env,
            input.childEnv,
          ) as unknown as NodeJS.ProcessEnv,
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
      raw = await readCurrentReleaseResult(
        expectedPaths,
        input.runId,
      )
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
  await writeCurrentReleaseJournal(
    getCurrentReleasePaths(workspaceRoot, registry.runId),
    registry,
  )
}

export async function readCurrentReleaseRegistry(
  workspaceRoot: string,
  runId: string,
): Promise<SyntheticCleanupRegistry | null> {
  const paths = getCurrentReleasePaths(workspaceRoot, runId)
  try {
    return await readCurrentReleaseJournal(paths, runId)
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null
    }
    throw error
  }
}

export async function removeCurrentReleaseRegistry(
  workspaceRoot: string,
  runId: string,
): Promise<void> {
  await removeCurrentReleaseJournal(
    getCurrentReleasePaths(workspaceRoot, runId),
  )
}

export async function writeCurrentReleaseReport(
  workspaceRoot: string,
  report: CurrentReleaseReport,
): Promise<void> {
  await writeCurrentReleaseReportArtifacts(
    getCurrentReleasePaths(workspaceRoot, report.runId),
    report.runId,
    serializeCurrentReleaseReport(report),
    `${renderCurrentReleaseReportMarkdown(report)}\n`,
  )
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

export function createCurrentReleaseGuardNonce(): string {
  return randomBytes(32).toString('base64url')
}

export async function prepareCurrentReleaseGuard(input: {
  paths: CurrentReleasePaths
  runId: string
  nonce: string
}): Promise<void> {
  await writePlaywrightGuardMarker(
    input.paths,
    input.runId,
    input.nonce,
  )
}

export function buildPlaywrightChildEnvironment(
  parent: Record<string, string | undefined>,
  contract: Record<string, string>,
): Record<string, string> {
  const allowedSystemKeys = [
    'PATH',
    'HOME',
    'TMPDIR',
    'LANG',
    'LC_ALL',
    'PLAYWRIGHT_BROWSERS_PATH',
  ] as const
  const environment: Record<string, string> = {}
  for (const key of allowedSystemKeys) {
    const value = parent[key]?.trim()
    if (value) environment[key] = value
  }
  for (const [key, value] of Object.entries(contract)) {
    if (
      key.startsWith('CURRENT_RELEASE_') ||
      key === 'ADMIN_PASSWORD' ||
      key === 'AWS_PROFILE' ||
      key === 'AWS_REGION'
    ) {
      environment[key] = value
    }
  }
  return environment
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

function validateBrowserUsage(result: BrowserExecutionResult): void {
  if (
    result.usage.onboardingGenerationCalls >
      CURRENT_RELEASE_COST_RESERVATIONS.onboardingGenerationCalls ||
    result.usage.agentCalls >
      CURRENT_RELEASE_COST_RESERVATIONS.agentCalls ||
    (result.usage.sourcePipelineCalls === 0 &&
      result.usage.observedPipelineCostUsd !== 0) ||
    (result.usage.sourcePipelineCalls === 1 &&
      result.usage.observedPipelineCostUsd >
        CURRENT_RELEASE_COST_RESERVATIONS.sourcePipelineUsd)
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

async function refreshRegistry(
  dependencies: CurrentReleaseRunnerDependencies,
  runId: string,
  fallback: SyntheticCleanupRegistry,
): Promise<SyntheticCleanupRegistry> {
  return (await dependencies.loadRegistry(runId)) ?? fallback
}
