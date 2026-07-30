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
  resolveOperatorContext,
  signInUser,
  verifyRunS3Empty,
  type OperatorBaseContext,
} from '../e2e/current-release/operator'
import {
  deleteSyntheticAccountByContract,
  restoreAdminAgentByContract,
} from '../e2e/current-release/http-cleanup'
import {
  cleanupCurrentRelease,
  waitForEphemeralStateExpiry,
} from '../src/features/current-release-acceptance/cleanup'
import {
  createCurrentReleasePassword,
  createCurrentReleaseGuardNonce,
  createCurrentReleaseRunId,
  createDefaultBrowserExecutor,
  prepareCurrentReleaseGuard,
  CURRENT_RELEASE_AWS_ACCOUNT,
  CURRENT_RELEASE_AWS_PROFILE,
  CURRENT_RELEASE_AWS_REGION,
  CURRENT_RELEASE_PRODUCTION_URL,
  removeCurrentReleaseRegistry,
  readCurrentReleaseRegistry,
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

export function normalizePulledCognitoClientId(
  value: string | undefined,
): string {
  return (value ?? '').trim().replace(/\\n$/u, '')
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
  const preflightContext: OperatorBaseContext = {
    runId: 'syn-20000101T000000Z-00000000',
    profile: CURRENT_RELEASE_AWS_PROFILE,
    region: CURRENT_RELEASE_AWS_REGION,
    accountId: CURRENT_RELEASE_AWS_ACCOUNT,
  }
  let resolvedPreflight:
    | ReturnType<typeof resolveOperatorContext>
    | undefined
  const getResolvedPreflight = () =>
    (resolvedPreflight ??= resolveOperatorContext(
      preflightContext,
      executor,
    ).catch((error) => {
      throw mapCurrentReleasePreflightError(error)
    }))

  return {
    now: () => new Date(),
    createRunId: createCurrentReleaseRunId,
    createPassword: createCurrentReleasePassword,
    getConfiguredRegion: async (profile) => {
      const result = await executor.execute([
        'configure',
        'get',
        'region',
        '--profile',
        profile,
      ], { timeoutMs: 30_000 })
      if (!result.ok) {
        throw new Error('CURRENT_RELEASE_OPERATOR_READ_FAILED')
      }
      return result.stdout.trim()
    },
    getCallerIdentity: async () =>
      assertCallerIdentity(preflightContext, executor),
    checkDlq: async () =>
      checkDlq(await getResolvedPreflight(), executor),
    checkAlarms: async () =>
      checkAlarms(await getResolvedPreflight(), executor),
    saveRegistry: (registry) =>
      saveCurrentReleaseRegistry(workspaceRoot, registry),
    loadRegistry: (runId) =>
      readCurrentReleaseRegistry(workspaceRoot, runId),
    removeRegistry: (runId) =>
      removeCurrentReleaseRegistry(workspaceRoot, runId),
    createGuardNonce: createCurrentReleaseGuardNonce,
    prepareGuard: prepareCurrentReleaseGuard,
    executeBrowser: createDefaultBrowserExecutor(workspaceRoot),
    cleanup: async (input) => {
      const context = await resolveOperatorContext(
        {
          runId: input.registry.runId,
          profile: CURRENT_RELEASE_AWS_PROFILE,
          region: CURRENT_RELEASE_AWS_REGION,
          accountId: CURRENT_RELEASE_AWS_ACCOUNT,
        },
        executor,
      )
      const clientId = normalizePulledCognitoClientId(
        process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
      )
      return cleanupCurrentRelease(input, {
        assertIdentity: () =>
          assertCallerIdentity(context, executor).then(
            () => undefined,
          ),
        getUserSubject: (username) =>
          getUserSubject(context, username, executor),
        deleteAccount: ({ baseUrl, username, password }) =>
          deleteSyntheticAccountByContract(
            {
              baseUrl,
              username,
              password,
            },
            {
              signIn: (signInUsername, signInPassword) =>
                signInUser(
                  context,
                  signInUsername,
                  signInPassword,
                  clientId,
                  executor,
                ),
            },
          ),
        deleteIdentity: (username) =>
          deleteUser(context, username, executor),
        persistRegistry: (registry) =>
          saveCurrentReleaseRegistry(workspaceRoot, registry),
        restoreAdmin: (restoreInput) =>
          restoreAdminAgentByContract(restoreInput),
        verifyS3Empty: (s3Input) =>
          verifyRunS3Empty(context, s3Input, executor),
        checkDlq: () => checkDlq(context, executor),
        checkAlarms: () => checkAlarms(context, executor),
        waitUntilEpochSeconds:
          waitForEphemeralStateExpiry,
      })
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
): Promise<number> {
  const workspaceRoot = process.cwd()
  return runCurrentReleaseCli(args, {
    execute: (cli) =>
      runCurrentReleaseAcceptance(
        {
          ...cli,
          profile: CURRENT_RELEASE_AWS_PROFILE,
          region: CURRENT_RELEASE_AWS_REGION,
          adminPassword: process.env.ADMIN_PASSWORD,
          acceptanceSecret:
            process.env.CURRENT_RELEASE_ACCEPTANCE_SECRET,
          workspaceRoot,
        },
        createDefaultCurrentReleaseDependencies(workspaceRoot),
      ),
    writeOutput: (value) => process.stdout.write(value),
    writeError: (value) => process.stderr.write(value),
  })
}

export async function runCurrentReleaseCli(
  args: string[],
  runtime: {
    execute: (
      options: CurrentReleaseCliOptions,
    ) => Promise<{ runId?: string; accepted?: boolean }>
    writeOutput: (value: string) => unknown
    writeError: (value: string) => unknown
  },
): Promise<number> {
  try {
    const cli = parseCurrentReleaseCliArgs(args)
    const report = await runtime.execute(cli)
    runtime.writeOutput(
      `${JSON.stringify({
        runId: report.runId,
        accepted: report.accepted === true,
      })}\n`,
    )
    return report.accepted === true ? 0 : 1
  } catch (error) {
    const errorCode = safeErrorCode(error)
    runtime.writeError(
      `${JSON.stringify({
        accepted: false,
        errorCode,
      })}\n`,
    )
    return 1
  }
}

export function mapCurrentReleasePreflightError(
  error: unknown,
): Error {
  if (
    error instanceof Error &&
    error.message ===
      'CURRENT_RELEASE_COGNITO_RESOURCE_UNVERIFIED'
  ) {
    return new Error(
      'CURRENT_RELEASE_COGNITO_PREREQUISITE_MISSING:SEE_RUNBOOK',
    )
  }
  return error instanceof Error
    ? error
    : new Error('CURRENT_RELEASE_OPERATOR_READ_FAILED')
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

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1]
  return Boolean(
    entryPoint &&
      import.meta.url === pathToFileURL(entryPoint).href,
  )
}

if (isDirectExecution()) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode
    })
    .catch(() => {
      process.stderr.write(
        `${JSON.stringify({
          accepted: false,
          errorCode: 'CURRENT_RELEASE_ACCEPTANCE_FAILED',
        })}\n`,
      )
      process.exitCode = 1
    })
}

function safeErrorCode(error: unknown): string {
  return error instanceof Error &&
    /^CURRENT_RELEASE_[A-Z0-9_:.-]+$/.test(error.message)
    ? error.message
    : 'CURRENT_RELEASE_ACCEPTANCE_FAILED'
}
