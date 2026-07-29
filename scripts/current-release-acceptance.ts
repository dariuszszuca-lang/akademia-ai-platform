#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import {
  assertCallerIdentity,
  checkAlarms,
  checkDlq,
  createAwsCommandExecutor,
  deleteUser,
  getUserSubject,
  type OperatorContext,
} from '../e2e/current-release/operator'
import {
  createCurrentReleasePassword,
  createCurrentReleaseRunId,
  createDefaultBrowserExecutor,
  CURRENT_RELEASE_AWS_ACCOUNT,
  CURRENT_RELEASE_AWS_PROFILE,
  CURRENT_RELEASE_AWS_REGION,
  CURRENT_RELEASE_PRODUCTION_URL,
  removeCurrentReleaseRegistry,
  runCurrentReleaseAcceptance,
  saveCurrentReleaseRegistry,
  writeCurrentReleaseReport,
  type CurrentReleaseRunnerDependencies,
} from '../src/features/current-release-acceptance/runner'

type CurrentReleaseCliOptions = {
  allowProduction: true
  baseUrl: typeof CURRENT_RELEASE_PRODUCTION_URL
  maxCostUsd: 2
}

export function parseCurrentReleaseCliArgs(
  args: string[],
): CurrentReleaseCliOptions {
  if (
    args.length !== 5 ||
    args[0] !== '--allow-production' ||
    args[1] !== '--base-url' ||
    args[2] !== CURRENT_RELEASE_PRODUCTION_URL ||
    args[3] !== '--max-cost-usd' ||
    args[4] !== '2'
  ) {
    throw new Error('CURRENT_RELEASE_CLI_INVALID')
  }
  return {
    allowProduction: true,
    baseUrl: CURRENT_RELEASE_PRODUCTION_URL,
    maxCostUsd: 2,
  }
}

export function createDefaultCurrentReleaseDependencies(
  workspaceRoot: string,
): CurrentReleaseRunnerDependencies {
  const executor = createAwsCommandExecutor()
  const preflightContext: OperatorContext = {
    runId: 'syn-20000101T000000Z-00000000',
    profile: CURRENT_RELEASE_AWS_PROFILE,
    region: CURRENT_RELEASE_AWS_REGION,
    accountId: CURRENT_RELEASE_AWS_ACCOUNT,
    stackName: 'PropertySourceStorage-prod',
  }

  return {
    now: () => new Date(),
    createRunId: createCurrentReleaseRunId,
    createPassword: createCurrentReleasePassword,
    getConfiguredRegion: async (profile) =>
      runAwsText([
        'configure',
        'get',
        'region',
        '--profile',
        profile,
      ]).trim(),
    getCallerIdentity: async () =>
      assertCallerIdentity(preflightContext, executor),
    checkDlq: () => checkDlq(preflightContext, executor),
    checkAlarms: () => checkAlarms(preflightContext, executor),
    saveRegistry: (registry) =>
      saveCurrentReleaseRegistry(workspaceRoot, registry),
    removeRegistry: (runId) =>
      removeCurrentReleaseRegistry(workspaceRoot, runId),
    executeBrowser: createDefaultBrowserExecutor(workspaceRoot),
    cleanup: async (registry) => {
      const userPoolId = readOptionalEnvironment(
        'COGNITO_USER_POOL_ID',
        'NEXT_PUBLIC_COGNITO_USER_POOL_ID',
      )
      let cognitoUsersAbsent = false
      if (userPoolId) {
        const context: OperatorContext = {
          runId: registry.runId,
          profile: CURRENT_RELEASE_AWS_PROFILE,
          region: CURRENT_RELEASE_AWS_REGION,
          accountId: CURRENT_RELEASE_AWS_ACCOUNT,
          userPoolId,
          stackName: 'PropertySourceStorage-prod',
        }
        for (const user of registry.releaseUsers) {
          await deleteUser(context, user.username, executor)
        }
        const remainingSubjects = await Promise.all(
          registry.releaseUsers.map((user) =>
            getUserSubject(context, user.username, executor),
          ),
        )
        cognitoUsersAbsent = remainingSubjects.every(
          (subject) => subject === null,
        )
      }

      return {
        // Tasks 8-9 replace these conservative placeholders with
        // browser/API cleanup evidence. They intentionally cannot accept a
        // production run on their own.
        databaseEmpty: false,
        cognitoUsersAbsent,
        kvKeysAbsent: registry.kvKeys.length === 0,
        s3VersionsRemaining:
          registry.storageKeys.length === 0 ? 0 : 1,
        adminStateRestored: registry.adminAgentState === null,
        dlqMessagesVisible: await checkDlq(
          preflightContext,
          executor,
        ),
        alarmsNotOk: await checkAlarms(
          preflightContext,
          executor,
        ),
      }
    },
    getCommitSha: async () =>
      runProgramText('git', ['rev-parse', 'HEAD'], workspaceRoot).trim(),
    getDeploymentId: async () => {
      const deploymentId =
        process.env.CURRENT_RELEASE_DEPLOYMENT_ID?.trim()
      if (!deploymentId) {
        throw new Error('CURRENT_RELEASE_DEPLOYMENT_ID_MISSING')
      }
      return deploymentId
    },
    writeReport: (report) =>
      writeCurrentReleaseReport(workspaceRoot, report),
  }
}

export async function main(
  args = process.argv.slice(2),
): Promise<void> {
  const cli = parseCurrentReleaseCliArgs(args)
  const workspaceRoot = process.cwd()
  const report = await runCurrentReleaseAcceptance(
    {
      ...cli,
      profile: CURRENT_RELEASE_AWS_PROFILE,
      region: CURRENT_RELEASE_AWS_REGION,
      adminPassword: process.env.ADMIN_PASSWORD,
      workspaceRoot,
    },
    createDefaultCurrentReleaseDependencies(workspaceRoot),
  )
  process.stdout.write(
    `${JSON.stringify({
      runId: report.runId,
      accepted: report.accepted,
    })}\n`,
  )
}

function runAwsText(args: string[]): string {
  return runProgramText('aws', args)
}

function runProgramText(
  executable: string,
  args: string[],
  cwd?: string,
): string {
  try {
    return execFileSync(executable, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    })
  } catch {
    throw new Error('CURRENT_RELEASE_OPERATOR_READ_FAILED')
  }
}

function readOptionalEnvironment(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return null
}

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1]
  return Boolean(
    entryPoint &&
      import.meta.url === pathToFileURL(entryPoint).href,
  )
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error &&
      /^CURRENT_RELEASE_[A-Z0-9_:.-]+$/.test(error.message)
        ? error.message
        : 'CURRENT_RELEASE_ACCEPTANCE_FAILED'
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
