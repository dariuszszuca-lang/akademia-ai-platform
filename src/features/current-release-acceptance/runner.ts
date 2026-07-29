import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  getCurrentReleasePaths,
  prepareCurrentReleaseResultPath,
  removeCurrentReleaseEphemeralArtifacts,
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
  parseSyntheticCleanupRegistry,
  type SyntheticCleanupRegistry,
} from '../synthetic-acceptance/cleanup-registry'
import {
  createAcceptanceCostGuard,
  CURRENT_RELEASE_COST_STOP_USD,
  CURRENT_RELEASE_MAX_COST_USD,
  currentReleaseRunIdSchema,
} from './domain'
import {
  browserRegistryUpdateSchema,
  parseBrowserExecutionResult,
  type BrowserExecutionResult,
  type BrowserRegistryUpdate,
} from './browser-result'
import { currentReleaseAcceptanceSecretSchema } from './legal-probe'
import {
  createCurrentReleaseReport,
  renderCurrentReleaseReportMarkdown,
  serializeCurrentReleaseReport,
  type CurrentReleaseReport,
} from './report'
import {
  type CurrentReleaseCleanup,
  type CurrentReleaseCleanupInput,
} from './cleanup'

export type { CurrentReleaseCleanup } from './cleanup'

export const CURRENT_RELEASE_PRODUCTION_URL =
  'https://akademia-ai-platform.vercel.app'
export const CURRENT_RELEASE_AWS_ACCOUNT = '261965598943'
export const CURRENT_RELEASE_AWS_PROFILE = 'akademia-ai'
export const CURRENT_RELEASE_AWS_REGION = 'eu-central-1'
export const CURRENT_RELEASE_AWS_CALLER_ARN =
  'arn:aws:iam::261965598943:user/akademia-wojtka-admin-darek'

export const CURRENT_RELEASE_COST_RESERVATIONS = {
  onboardingGenerationUsd: 0.06,
  onboardingGenerationCalls: 9,
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
  acceptanceSecret: string | undefined
  workspaceRoot: string
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
    input: CurrentReleaseCleanupInput,
  ) => Promise<CurrentReleaseCleanup>
  getCommitSha: () => Promise<string>
  getDeploymentId: () => Promise<string>
  writeReport: (report: CurrentReleaseReport) => Promise<void>
}

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
    CURRENT_RELEASE_ACCEPTANCE_SECRET:
      options.acceptanceSecret!,
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
  let cleanupDurationMs = 0

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
    try {
      browserResult = parseBrowserExecutionResult(candidate)
    } catch {
      executionErrorCode =
        'CURRENT_RELEASE_BROWSER_RESULT_INVALID'
    }
    if (browserResult) {
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
    const cleanupStartedAt = dependencies.now()
    try {
      activeRegistry = await refreshRegistry(
        dependencies,
        runId,
        activeRegistry,
      )
      cleanup = await dependencies.cleanup({
        registry: activeRegistry,
        baseUrl: options.baseUrl,
        adminPassword: options.adminPassword!.trim(),
        credentials: [
          {
            role: 'a',
            username: registry.releaseUsers[0]!.username,
            password: passwordA,
          },
          {
            role: 'b',
            username: registry.releaseUsers[1]!.username,
            password: passwordB,
          },
        ],
      })
    } catch {
      cleanupFailed = true
    } finally {
      cleanupDurationMs = durationBetween(
        cleanupStartedAt,
        dependencies.now(),
      )
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

  let parsedBrowser: BrowserExecutionResult
  try {
    parsedBrowser = parseBrowserExecutionResult(browserResult)
  } catch {
    throw new Error('CURRENT_RELEASE_BROWSER_RESULT_INVALID')
  }
  validateBrowserUsage(parsedBrowser, childBudget.maxUsd)
  const costGuard = createAcceptanceCostGuard({
    stopBeforeUsd: childBudget.stopBeforeUsd,
    maxUsd: childBudget.maxUsd,
  })
  for (
    let index = 0;
    index < parsedBrowser.usage.onboardingGenerationCalls;
    index += 1
  ) {
    costGuard.reserve(
      `onboarding.${index + 1}`,
      CURRENT_RELEASE_COST_RESERVATIONS.onboardingGenerationUsd,
    )
  }
  for (
    let index = 0;
    index < parsedBrowser.usage.agentCalls;
    index += 1
  ) {
    costGuard.reserve(
      `agent.${index + 1}`,
      CURRENT_RELEASE_COST_RESERVATIONS.agentCallUsd,
    )
  }
  if (parsedBrowser.usage.sourcePipelineCalls === 1) {
    costGuard.reserve(
      'pipeline',
      CURRENT_RELEASE_COST_RESERVATIONS.sourcePipelineUsd,
    )
    costGuard.recordObservedPipelineCost(
      parsedBrowser.usage.observedPipelineCostUsd,
    )
  }
  const estimatedAnthropicCostUsd =
    CURRENT_RELEASE_COST_RESERVATIONS.onboardingGenerationUsd *
      parsedBrowser.usage.onboardingGenerationCalls +
    CURRENT_RELEASE_COST_RESERVATIONS.agentCallUsd *
      parsedBrowser.usage.agentCalls
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
    scenarios: [
      ...parsedBrowser.scenarios,
      cleanupPassed
        ? {
            name: 'cleanup.complete' as const,
            status: 'passed' as const,
            durationMs: cleanupDurationMs,
          }
        : {
            name: 'cleanup.complete' as const,
            status: 'failed' as const,
            durationMs: cleanupDurationMs,
            errorCode:
              'CURRENT_RELEASE_CLEANUP_INCOMPLETE' as const,
          },
    ],
    modelIds: parsedBrowser.modelIds,
    estimatedAnthropicCostUsd: roundUsd(
      estimatedAnthropicCostUsd,
    ),
    observedPipelineCostUsd,
    providerCostUsd,
    cleanup,
    accepted:
      cleanupPassed &&
      parsedBrowser.scenarios.every(
        (scenario) => scenario.status === 'passed',
      ),
  })

  try {
    await dependencies.writeReport(report)
  } catch {
    throw new Error('CURRENT_RELEASE_REPORT_WRITE_FAILED')
  }
  if (cleanupPassed) {
    await dependencies.removeRegistry(runId)
  }
  if (!report.accepted) {
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
    try {
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
        // A failing scenario makes Playwright exit nonzero, but afterAll
        // still persists the safe, partial result. Read it below.
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
        return parseBrowserExecutionResult(JSON.parse(raw))
      } catch {
        throw new Error('CURRENT_RELEASE_BROWSER_RESULT_INVALID')
      }
    } finally {
      await removeCurrentReleaseEphemeralArtifacts(
        expectedPaths,
        input.runId,
      )
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
  const allowedContractKeys = new Set([
    'CURRENT_RELEASE_RUN_ID',
    'CURRENT_RELEASE_BASE_URL',
    'CURRENT_RELEASE_USER_A',
    'CURRENT_RELEASE_USER_A_PASSWORD',
    'CURRENT_RELEASE_USER_B',
    'CURRENT_RELEASE_USER_B_PASSWORD',
    'CURRENT_RELEASE_ACCEPTANCE_SECRET',
    'ADMIN_PASSWORD',
    'AWS_PROFILE',
    'AWS_REGION',
    'CURRENT_RELEASE_RESULT_PATH',
    'CURRENT_RELEASE_REGISTRY_PATH',
    'CURRENT_RELEASE_GUARD_MARKER_PATH',
    'CURRENT_RELEASE_WORKSPACE_ROOT',
    'CURRENT_RELEASE_RUNNER_GUARD',
    'CURRENT_RELEASE_BUDGET',
  ])
  const environment: Record<string, string> = {}
  for (const key of allowedSystemKeys) {
    const value = parent[key]?.trim()
    if (value) environment[key] = value
  }
  for (const [key, value] of Object.entries(contract)) {
    if (allowedContractKeys.has(key)) {
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
  if (!options.acceptanceSecret) {
    throw new Error('CURRENT_RELEASE_ACCEPTANCE_SECRET_MISSING')
  }
  if (
    !currentReleaseAcceptanceSecretSchema.safeParse(
      options.acceptanceSecret,
    ).success ||
    options.acceptanceSecret === options.adminPassword
  ) {
    throw new Error('CURRENT_RELEASE_ACCEPTANCE_SECRET_INVALID')
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

export function validateBrowserUsage(
  result: BrowserExecutionResult,
  maxCostUsd: number,
): void {
  const {
    onboardingGenerationCalls,
    agentCalls,
    sourcePipelineCalls,
    observedPipelineCostUsd,
  } = result.usage
  const counts = [
    onboardingGenerationCalls,
    agentCalls,
    sourcePipelineCalls,
  ]
  const reservedUsd = roundUsd(
    onboardingGenerationCalls *
      CURRENT_RELEASE_COST_RESERVATIONS.onboardingGenerationUsd +
      agentCalls *
        CURRENT_RELEASE_COST_RESERVATIONS.agentCallUsd +
      sourcePipelineCalls *
        CURRENT_RELEASE_COST_RESERVATIONS.sourcePipelineUsd,
  )
  const observedTotalUsd = roundUsd(
    onboardingGenerationCalls *
      CURRENT_RELEASE_COST_RESERVATIONS.onboardingGenerationUsd +
      agentCalls *
        CURRENT_RELEASE_COST_RESERVATIONS.agentCallUsd +
      observedPipelineCostUsd,
  )
  const allScenariosPassed = result.scenarios.every(
    (scenario) => scenario.status === 'passed',
  )
  if (
    !Number.isFinite(maxCostUsd) ||
    maxCostUsd <= 0 ||
    maxCostUsd > CURRENT_RELEASE_MAX_COST_USD ||
    counts.some(
      (count) =>
        !Number.isInteger(count) ||
        !Number.isFinite(count) ||
        count < 0,
    ) ||
    onboardingGenerationCalls >
      CURRENT_RELEASE_COST_RESERVATIONS.onboardingGenerationCalls ||
    agentCalls >
      CURRENT_RELEASE_COST_RESERVATIONS.agentCalls ||
    ![0, 1].includes(sourcePipelineCalls) ||
    !Number.isFinite(observedPipelineCostUsd) ||
    observedPipelineCostUsd < 0 ||
    (sourcePipelineCalls === 0 &&
      observedPipelineCostUsd !== 0) ||
    reservedUsd > Math.min(CURRENT_RELEASE_COST_STOP_USD, maxCostUsd) ||
    observedTotalUsd > maxCostUsd ||
    (allScenariosPassed &&
      (onboardingGenerationCalls !==
        CURRENT_RELEASE_COST_RESERVATIONS.onboardingGenerationCalls ||
        agentCalls !==
          CURRENT_RELEASE_COST_RESERVATIONS.agentCalls ||
        sourcePipelineCalls !== 1))
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

  const candidate = parseSyntheticCleanupRegistry({
    ...registry,
    ...parsed.data,
  })
  Object.assign(registry, candidate)
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

function durationBetween(startedAt: Date, completedAt: Date): number {
  const durationMs = completedAt.getTime() - startedAt.getTime()
  if (
    !Number.isFinite(durationMs) ||
    durationMs < 0 ||
    durationMs > 3_600_000
  ) {
    throw new Error('CURRENT_RELEASE_CLEANUP_DURATION_INVALID')
  }
  return Math.floor(durationMs)
}

async function refreshRegistry(
  dependencies: CurrentReleaseRunnerDependencies,
  runId: string,
  fallback: SyntheticCleanupRegistry,
): Promise<SyntheticCleanupRegistry> {
  return (await dependencies.loadRegistry(runId)) ?? fallback
}
