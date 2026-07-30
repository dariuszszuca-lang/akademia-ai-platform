import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import {
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path'
import {
  parseSyntheticCleanupRegistry,
  safeDeletionReceiptSchema,
  type SafeDeletionReceipt,
  type SyntheticCleanupRegistry,
} from '../../src/features/synthetic-acceptance/cleanup-registry'
import { parseBrowserExecutionResult } from '../../src/features/current-release-acceptance/browser-result'
import { currentReleaseRunIdSchema } from '../../src/features/current-release-acceptance/domain'

export type CurrentReleasePaths = {
  workspaceRoot: string
  reportDirectory: string
  browserDirectory: string
  registryPath: string
  resultPath: string
  guardMarkerPath: string
}

export function getCurrentReleasePaths(
  workspaceRoot: string,
  runId: string,
): CurrentReleasePaths {
  const parsedRunId = currentReleaseRunIdSchema.parse(runId)
  if (!isAbsolute(workspaceRoot)) {
    throw new Error('CURRENT_RELEASE_PATH_INVALID')
  }
  const root = resolve(workspaceRoot)
  const reportDirectory = resolve(
    root,
    'reports',
    'current-release-acceptance',
  )
  const browserDirectory = resolve(
    root,
    'Temp',
    'current-release-playwright',
    parsedRunId,
  )
  const paths = {
    workspaceRoot: root,
    reportDirectory,
    browserDirectory,
    registryPath: resolve(
      reportDirectory,
      `${parsedRunId}.run.json`,
    ),
    resultPath: resolve(browserDirectory, 'result.json'),
    guardMarkerPath: resolve(browserDirectory, 'guard.json'),
  }
  assertContained(
    reportDirectory,
    paths.registryPath,
    `${parsedRunId}.run.json`,
  )
  assertContained(
    browserDirectory,
    paths.resultPath,
    'result.json',
  )
  assertContained(
    browserDirectory,
    paths.guardMarkerPath,
    'guard.json',
  )
  return paths
}

export async function writeCurrentReleaseJournal(
  paths: CurrentReleasePaths,
  value: SyntheticCleanupRegistry,
): Promise<void> {
  const expectedRunId = assertExactPaths(paths)
  if (value.runId !== expectedRunId) {
    throw new Error('CURRENT_RELEASE_JOURNAL_INVALID')
  }
  const registry = parseSyntheticCleanupRegistry(value)
  await ensureSafeDirectory(paths.workspaceRoot, paths.reportDirectory)
  await rejectUnsafeExistingFile(paths.registryPath)
  const temporaryPath = resolve(
    paths.reportDirectory,
    `${registry.runId}.run.${process.pid}.${Date.now()}.tmp`,
  )
  assertContained(paths.reportDirectory, temporaryPath)
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(registry, null, 2)}\n`,
      { mode: 0o600, flag: 'wx' },
    )
    await rejectUnsafeExistingFile(paths.registryPath)
    await rename(temporaryPath, paths.registryPath)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

export async function readCurrentReleaseJournal(
  paths: CurrentReleasePaths,
  expectedRunId: string,
): Promise<SyntheticCleanupRegistry> {
  assertExactPaths(paths)
  const parsedRunId = currentReleaseRunIdSchema.parse(expectedRunId)
  await ensureSafeDirectory(paths.workspaceRoot, paths.reportDirectory)
  const file = await lstat(paths.registryPath)
  if (!file.isFile() || file.isSymbolicLink()) {
    throw new Error('CURRENT_RELEASE_PATH_INVALID')
  }
  let raw: unknown
  try {
    raw = JSON.parse(await readFile(paths.registryPath, 'utf8'))
  } catch {
    throw new Error('CURRENT_RELEASE_JOURNAL_INVALID')
  }
  const registry = parseSyntheticCleanupRegistry(raw)
  if (registry.runId !== parsedRunId) {
    throw new Error('CURRENT_RELEASE_JOURNAL_INVALID')
  }
  return registry
}

export async function removeCurrentReleaseJournal(
  paths: CurrentReleasePaths,
): Promise<void> {
  assertExactPaths(paths)
  await ensureSafeDirectory(paths.workspaceRoot, paths.reportDirectory)
  try {
    const stat = await lstat(paths.registryPath)
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error('CURRENT_RELEASE_PATH_INVALID')
    }
    await rm(paths.registryPath)
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return
    }
    throw error
  }
}

export async function prepareCurrentReleaseResultPath(
  paths: CurrentReleasePaths,
  runId: string,
): Promise<void> {
  const expected = getCurrentReleasePaths(paths.workspaceRoot, runId)
  assertPathsEqual(paths, expected)
  await ensureSafeDirectory(paths.workspaceRoot, paths.browserDirectory)
  try {
    const stat = await lstat(paths.resultPath)
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error('CURRENT_RELEASE_PATH_INVALID')
    }
    await rm(paths.resultPath)
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return
    }
    throw error
  }
}

export async function readCurrentReleaseResult(
  paths: CurrentReleasePaths,
  runId: string,
): Promise<string> {
  const expected = getCurrentReleasePaths(paths.workspaceRoot, runId)
  assertPathsEqual(paths, expected)
  await ensureSafeDirectory(paths.workspaceRoot, paths.browserDirectory)
  const stat = await lstat(paths.resultPath)
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error('CURRENT_RELEASE_PATH_INVALID')
  }
  return readFile(paths.resultPath, 'utf8')
}

export async function writeCurrentReleaseResult(
  paths: CurrentReleasePaths,
  runId: string,
  value: unknown,
): Promise<void> {
  const expected = getCurrentReleasePaths(paths.workspaceRoot, runId)
  assertPathsEqual(paths, expected)
  const result = parseBrowserExecutionResult(value)
  await ensureSafeDirectory(
    paths.workspaceRoot,
    paths.browserDirectory,
  )
  await rejectUnsafeExistingFile(paths.resultPath)
  const temporaryPath = resolve(
    paths.browserDirectory,
    `result.${process.pid}.${Date.now()}.tmp`,
  )
  assertContained(paths.browserDirectory, temporaryPath)
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(result, null, 2)}\n`,
      { mode: 0o600, flag: 'wx' },
    )
    await rejectUnsafeExistingFile(paths.resultPath)
    await rename(temporaryPath, paths.resultPath)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

export async function removeCurrentReleaseEphemeralArtifacts(
  paths: CurrentReleasePaths,
  runId: string,
): Promise<void> {
  const expected = getCurrentReleasePaths(paths.workspaceRoot, runId)
  assertPathsEqual(paths, expected)
  await ensureSafeDirectory(paths.workspaceRoot, paths.browserDirectory)
  for (const path of [paths.resultPath, paths.guardMarkerPath]) {
    try {
      const stat = await lstat(path)
      if (stat.isDirectory()) {
        throw new Error('CURRENT_RELEASE_PATH_INVALID')
      }
      await rm(path)
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        continue
      }
      throw error
    }
  }
}

export async function writeCurrentReleaseReportArtifacts(
  paths: CurrentReleasePaths,
  runId: string,
  json: string,
  markdown: string,
): Promise<void> {
  const expected = getCurrentReleasePaths(paths.workspaceRoot, runId)
  assertPathsEqual(paths, expected)
  await ensureSafeDirectory(paths.workspaceRoot, paths.reportDirectory)
  await Promise.all([
    writeAtomicArtifact(
      paths.reportDirectory,
      resolve(paths.reportDirectory, `${runId}.json`),
      json,
    ),
    writeAtomicArtifact(
      paths.reportDirectory,
      resolve(paths.reportDirectory, `${runId}.md`),
      markdown,
    ),
  ])
}

export function createCurrentReleaseJournal(
  paths: CurrentReleasePaths,
  runId: string,
) {
  const parsedRunId = currentReleaseRunIdSchema.parse(runId)
  let sequence = Promise.resolve()

  function update(
    mutate: (registry: SyntheticCleanupRegistry) => void,
  ): Promise<void> {
    const operation = sequence.then(async () => {
      const registry = await readCurrentReleaseJournal(
        paths,
        parsedRunId,
      )
      mutate(registry)
      await writeCurrentReleaseJournal(paths, registry)
    })
    sequence = operation.then(
      () => undefined,
      () => undefined,
    )
    return operation
  }

  return {
    recordUserSubject(
      role: 'a' | 'b',
      cognitoSub: string,
    ): Promise<void> {
      return update((registry) => {
        const user = registry.releaseUsers.find(
          (candidate) => candidate.role === role,
        )
        if (!user) {
          throw new Error('CURRENT_RELEASE_JOURNAL_INVALID')
        }
        if (
          user.cognitoSub !== null &&
          user.cognitoSub !== cognitoSub
        ) {
          throw new Error('CURRENT_RELEASE_USER_SUBJECT_CONFLICT')
        }
        user.cognitoSub = cognitoSub
      })
    },

    recordKvKey(kvKey: string): Promise<void> {
      return update((registry) => {
        if (!registry.kvKeys.includes(kvKey)) {
          registry.kvKeys.push(kvKey)
        }
      })
    },

    recordAdminPreviousState(
      agentId: 'publikacja',
      enabled: boolean,
    ): Promise<void> {
      return update((registry) => {
        if (
          registry.adminAgentState !== null &&
          (registry.adminAgentState.agentId !== agentId ||
            registry.adminAgentState.enabled !== enabled)
        ) {
          throw new Error('CURRENT_RELEASE_ADMIN_STATE_CONFLICT')
        }
        registry.adminAgentState = { agentId, enabled }
      })
    },

    recordFactId(factId: string): Promise<void> {
      return update((registry) => {
        pushUnique(registry.factIds, factId)
      })
    },

    recordDeletionReceipt(
      role: 'a' | 'b',
      value: SafeDeletionReceipt,
    ): Promise<void> {
      const receipt = safeDeletionReceiptSchema.parse(value)
      return update((registry) => {
        const existing = registry.accountDeletionReceipts.find(
          (candidate) => candidate.role === role,
        )
        if (existing) {
          if (
            existing.ok !== receipt.ok ||
            existing.sourceObjects !== receipt.sourceObjects ||
            existing.propertyStudio !== receipt.propertyStudio ||
            existing.accountKeys !== receipt.accountKeys
          ) {
            throw new Error(
              'CURRENT_RELEASE_DELETION_RECEIPT_CONFLICT',
            )
          }
          return
        }
        registry.accountDeletionReceipts.push({
          role,
          ...receipt,
        })
      })
    },

    recordEphemeralStateExpiresAt(
      expiresAtEpochSeconds: number,
    ): Promise<void> {
      return update((registry) => {
        registry.ephemeralStateExpiresAt = Math.max(
          registry.ephemeralStateExpiresAt ?? 0,
          expiresAtEpochSeconds,
        )
      })
    },

    recordResources(input: {
      organizationId: string
      projectId?: string
      factId?: string
      sourceId?: string
      sourceJobId?: string
      proposalId?: string
      storageKey?: string
    }): Promise<void> {
      return update((registry) => {
        if (
          registry.organizationId &&
          registry.organizationId !== input.organizationId
        ) {
          throw new Error('CURRENT_RELEASE_JOURNAL_INVALID')
        }
        registry.organizationId = input.organizationId
        registry.organizationPrefix =
          `originals/organizations/${input.organizationId}/`
        pushUnique(registry.projectIds, input.projectId)
        pushUnique(registry.factIds, input.factId)
        pushUnique(registry.sourceIds, input.sourceId)
        pushUnique(registry.sourceJobIds, input.sourceJobId)
        pushUnique(registry.proposalIds, input.proposalId)
        pushUnique(registry.storageKeys, input.storageKey)
      })
    },
  }
}

function pushUnique(
  values: string[],
  value: string | undefined,
): void {
  if (value && !values.includes(value)) values.push(value)
}

function assertExactPaths(paths: CurrentReleasePaths): string {
  let runId: string
  try {
    runId = extractRunId(paths.registryPath)
  } catch {
    throw new Error('CURRENT_RELEASE_PATH_INVALID')
  }
  const expected = getCurrentReleasePaths(
    paths.workspaceRoot,
    runId,
  )
  assertPathsEqual(paths, expected)
  return runId
}

function assertPathsEqual(
  actual: CurrentReleasePaths,
  expected: CurrentReleasePaths,
): void {
  if (
    Object.keys(expected).some(
      (key) =>
        expected[key as keyof CurrentReleasePaths] !==
        actual[key as keyof CurrentReleasePaths],
    )
  ) {
    throw new Error('CURRENT_RELEASE_PATH_INVALID')
  }
}

function extractRunId(registryPath: string): string {
  const fileName = registryPath.split(sep).at(-1) ?? ''
  return currentReleaseRunIdSchema.parse(
    fileName.replace(/\.run\.json$/, ''),
  )
}

function assertContained(
  parent: string,
  candidate: string,
  exactBaseName?: string,
): void {
  const path = relative(parent, candidate)
  if (
    path === '' ||
    path === '..' ||
    path.startsWith(`..${sep}`) ||
    isAbsolute(path) ||
    (exactBaseName !== undefined && path !== exactBaseName)
  ) {
    throw new Error('CURRENT_RELEASE_PATH_INVALID')
  }
}

async function ensureSafeDirectory(
  workspaceRoot: string,
  directory: string,
): Promise<void> {
  assertContained(workspaceRoot, directory)
  await rejectSymlink(workspaceRoot)
  const relativeDirectory = relative(workspaceRoot, directory)
  let current = workspaceRoot
  for (const segment of relativeDirectory.split(sep)) {
    current = resolve(current, segment)
    try {
      await rejectSymlink(current)
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        await mkdir(current, { mode: 0o700 })
      } else {
        throw error
      }
    }
  }
}

async function rejectSymlink(path: string): Promise<void> {
  const stat = await lstat(path)
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error('CURRENT_RELEASE_PATH_INVALID')
  }
}

async function rejectUnsafeExistingFile(path: string): Promise<void> {
  try {
    const stat = await lstat(path)
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error('CURRENT_RELEASE_PATH_INVALID')
    }
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return
    }
    throw error
  }
}

async function writeAtomicArtifact(
  directory: string,
  destination: string,
  contents: string,
): Promise<void> {
  assertContained(directory, destination)
  await rejectUnsafeExistingFile(destination)
  const temporaryPath = resolve(
    directory,
    `artifact.${process.pid}.${Date.now()}.${Math.random()
      .toString(16)
      .slice(2)}.tmp`,
  )
  assertContained(directory, temporaryPath)
  try {
    await writeFile(temporaryPath, contents, {
      mode: 0o600,
      flag: 'wx',
    })
    await rejectUnsafeExistingFile(destination)
    await rename(temporaryPath, destination)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}
