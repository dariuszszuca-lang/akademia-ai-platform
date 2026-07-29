import { createHash } from 'node:crypto'
import {
  lstatSync,
  readFileSync,
} from 'node:fs'
import {
  lstat,
  mkdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path'
import { z } from 'zod'
import {
  getCurrentReleasePaths,
  type CurrentReleasePaths,
} from './journal'
import { parseChildBudgetContract } from './budget'
import { parseCurrentReleaseFixtures } from './fixtures'
import { currentReleaseRunIdSchema } from '../../src/features/current-release-acceptance/domain'

const PRODUCTION_URL =
  'https://akademia-ai-platform.vercel.app'
const nonceSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
const markerSchema = z
  .object({
    runId: currentReleaseRunIdSchema,
    guardHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

export async function writePlaywrightGuardMarker(
  paths: CurrentReleasePaths,
  runId: string,
  nonce: string,
): Promise<void> {
  const expected = getCurrentReleasePaths(paths.workspaceRoot, runId)
  assertExactPaths(paths, expected)
  nonceSchema.parse(nonce)
  await ensureSafeDirectory(paths.workspaceRoot, paths.browserDirectory)
  await rejectUnsafeExistingFile(paths.guardMarkerPath)
  const temporaryPath = resolve(
    paths.browserDirectory,
    `guard.${process.pid}.${Date.now()}.tmp`,
  )
  assertContained(paths.browserDirectory, temporaryPath)
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify({
        runId,
        guardHash: createGuardHash(paths, runId, nonce),
      })}\n`,
      { mode: 0o600, flag: 'wx' },
    )
    await rejectUnsafeExistingFile(paths.guardMarkerPath)
    await rename(temporaryPath, paths.guardMarkerPath)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

export function assertPlaywrightLaunchAllowed(
  environment: Record<string, string | undefined> = process.env,
): void {
  if (environment.CURRENT_RELEASE_BASE_URL !== PRODUCTION_URL) return

  try {
    const fixtures = parseCurrentReleaseFixtures(environment)
    const nonce = nonceSchema.parse(
      environment.CURRENT_RELEASE_RUNNER_GUARD,
    )
    const registryPath = requireAbsolutePath(
      environment.CURRENT_RELEASE_REGISTRY_PATH,
    )
    const workspaceRoot =
      environment.CURRENT_RELEASE_WORKSPACE_ROOT?.trim() ||
      inferWorkspaceRoot(registryPath)
    const paths = getCurrentReleasePaths(workspaceRoot, fixtures.runId)
    if (
      registryPath !== paths.registryPath ||
      environment.CURRENT_RELEASE_RESULT_PATH !== paths.resultPath ||
      environment.CURRENT_RELEASE_GUARD_MARKER_PATH !==
        paths.guardMarkerPath
    ) {
      throw new Error('path mismatch')
    }
    if (
      environment.CURRENT_RELEASE_WORKSPACE_ROOT &&
      resolve(environment.CURRENT_RELEASE_WORKSPACE_ROOT) !==
        paths.workspaceRoot
    ) {
      throw new Error('workspace mismatch')
    }

    parseChildBudgetContract(
      environment.CURRENT_RELEASE_BUDGET ?? '',
    )
    assertSafeRegularFile(paths.workspaceRoot, paths.registryPath)
    assertSafeRegularFile(paths.workspaceRoot, paths.guardMarkerPath)
    const marker = markerSchema.parse(
      JSON.parse(readFileSync(paths.guardMarkerPath, 'utf8')),
    )
    if (
      marker.runId !== fixtures.runId ||
      marker.guardHash !==
        createGuardHash(paths, fixtures.runId, nonce)
    ) {
      throw new Error('guard mismatch')
    }
  } catch {
    throw new Error(
      'CURRENT_RELEASE_PLAYWRIGHT_PRODUCTION_GUARD_INVALID',
    )
  }
}

function createGuardHash(
  paths: CurrentReleasePaths,
  runId: string,
  nonce: string,
): string {
  return createHash('sha256')
    .update(
      [
        nonce,
        runId,
        paths.registryPath,
        paths.resultPath,
        paths.guardMarkerPath,
      ].join('\0'),
    )
    .digest('hex')
}

function inferWorkspaceRoot(registryPath: string): string {
  return dirname(dirname(dirname(registryPath)))
}

function requireAbsolutePath(value: string | undefined): string {
  if (!value || !isAbsolute(value)) throw new Error('path missing')
  return resolve(value)
}

function assertExactPaths(
  actual: CurrentReleasePaths,
  expected: CurrentReleasePaths,
): void {
  for (const key of Object.keys(expected) as Array<
    keyof CurrentReleasePaths
  >) {
    if (actual[key] !== expected[key]) {
      throw new Error('CURRENT_RELEASE_PATH_INVALID')
    }
  }
}

function assertSafeRegularFile(
  workspaceRoot: string,
  path: string,
): void {
  assertContained(workspaceRoot, path)
  let current = resolve(workspaceRoot)
  const rootStat = lstatSync(current)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('unsafe root')
  }
  for (const segment of relative(current, path).split(sep)) {
    current = resolve(current, segment)
    const stat = lstatSync(current)
    if (stat.isSymbolicLink()) throw new Error('symlink')
    if (current === path) {
      if (!stat.isFile()) throw new Error('not a file')
    } else if (!stat.isDirectory()) {
      throw new Error('not a directory')
    }
  }
}

async function ensureSafeDirectory(
  workspaceRoot: string,
  directory: string,
): Promise<void> {
  assertContained(workspaceRoot, directory)
  let current = resolve(workspaceRoot)
  const rootStat = await lstat(current)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('CURRENT_RELEASE_PATH_INVALID')
  }
  for (const segment of relative(current, directory).split(sep)) {
    current = resolve(current, segment)
    try {
      const stat = await lstat(current)
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error('CURRENT_RELEASE_PATH_INVALID')
      }
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

async function rejectUnsafeExistingFile(path: string): Promise<void> {
  try {
    const stat = await lstat(path)
    if (!stat.isFile() || stat.isSymbolicLink()) {
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

function assertContained(parent: string, candidate: string): void {
  const path = relative(parent, candidate)
  if (
    path === '' ||
    path === '..' ||
    path.startsWith(`..${sep}`) ||
    isAbsolute(path)
  ) {
    throw new Error('CURRENT_RELEASE_PATH_INVALID')
  }
}
