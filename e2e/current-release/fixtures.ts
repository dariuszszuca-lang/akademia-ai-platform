import { z } from 'zod'
import { currentReleaseRunIdSchema } from '../../src/features/current-release-acceptance/domain'
import { currentReleaseAcceptanceSecretSchema } from '../../src/features/current-release-acceptance/legal-probe'
import {
  getCurrentReleasePaths,
  type CurrentReleasePaths,
} from './journal'
import {
  parseChildBudgetContract,
  type ChildBudgetContract,
} from './budget'

const PRODUCTION_URL =
  'https://akademia-ai-platform.vercel.app' as const

const strongPasswordSchema = z
  .string()
  .min(20)
  .max(200)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/)
  .regex(/^\S+$/)

const adminPasswordSchema = z
  .string()
  .min(20)
  .max(200)

const environmentSchema = z
  .object({
    CURRENT_RELEASE_RUN_ID: currentReleaseRunIdSchema,
    CURRENT_RELEASE_BASE_URL: z.literal(PRODUCTION_URL),
    CURRENT_RELEASE_USER_A: z.string().max(180),
    CURRENT_RELEASE_USER_A_PASSWORD: strongPasswordSchema,
    CURRENT_RELEASE_USER_B: z.string().max(180),
    CURRENT_RELEASE_USER_B_PASSWORD: strongPasswordSchema,
    ADMIN_PASSWORD: adminPasswordSchema,
    CURRENT_RELEASE_ACCEPTANCE_SECRET:
      currentReleaseAcceptanceSecretSchema,
    AWS_PROFILE: z.literal('akademia-ai'),
    AWS_REGION: z.literal('eu-central-1'),
    CURRENT_RELEASE_WORKSPACE_ROOT: z.string().min(1),
    CURRENT_RELEASE_REGISTRY_PATH: z.string().min(1),
    CURRENT_RELEASE_RESULT_PATH: z.string().min(1),
    CURRENT_RELEASE_GUARD_MARKER_PATH: z.string().min(1),
    CURRENT_RELEASE_RUNNER_GUARD: z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/),
    CURRENT_RELEASE_BUDGET: z.string().min(1),
  })
  .passthrough()
  .superRefine((environment, context) => {
    const expectedA =
      `synthetic-release-${environment.CURRENT_RELEASE_RUN_ID}-a@example.invalid`
    const expectedB =
      `synthetic-release-${environment.CURRENT_RELEASE_RUN_ID}-b@example.invalid`
    if (environment.CURRENT_RELEASE_USER_A !== expectedA) {
      context.addIssue({
        code: 'custom',
        path: ['CURRENT_RELEASE_USER_A'],
        message: 'CURRENT_RELEASE_USER_A_INVALID',
      })
    }
    if (environment.CURRENT_RELEASE_USER_B !== expectedB) {
      context.addIssue({
        code: 'custom',
        path: ['CURRENT_RELEASE_USER_B'],
        message: 'CURRENT_RELEASE_USER_B_INVALID',
      })
    }
    if (
      environment.CURRENT_RELEASE_USER_A ===
      environment.CURRENT_RELEASE_USER_B
    ) {
      context.addIssue({
        code: 'custom',
        message: 'CURRENT_RELEASE_USERS_NOT_UNIQUE',
      })
    }
    if (
      environment.CURRENT_RELEASE_ACCEPTANCE_SECRET ===
      environment.ADMIN_PASSWORD
    ) {
      context.addIssue({
        code: 'custom',
        path: ['CURRENT_RELEASE_ACCEPTANCE_SECRET'],
        message: 'CURRENT_RELEASE_ACCEPTANCE_SECRET_INVALID',
      })
    }
    try {
      const paths = getCurrentReleasePaths(
        environment.CURRENT_RELEASE_WORKSPACE_ROOT,
        environment.CURRENT_RELEASE_RUN_ID,
      )
      if (
        paths.registryPath !==
          environment.CURRENT_RELEASE_REGISTRY_PATH ||
        paths.resultPath !==
          environment.CURRENT_RELEASE_RESULT_PATH ||
        paths.guardMarkerPath !==
          environment.CURRENT_RELEASE_GUARD_MARKER_PATH
      ) {
        throw new Error('path mismatch')
      }
      parseChildBudgetContract(
        environment.CURRENT_RELEASE_BUDGET,
      )
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'CURRENT_RELEASE_RUNNER_CONTRACT_INVALID',
      })
    }
  })

export type CurrentReleaseFixtures = {
  runId: string
  baseUrl: typeof PRODUCTION_URL
  userA: string
  passwordA: string
  userB: string
  passwordB: string
  adminPassword: string
  acceptanceSecret: string
  awsProfile: 'akademia-ai'
  awsRegion: 'eu-central-1'
  paths: CurrentReleasePaths
  runnerGuard: string
  budget: ChildBudgetContract
}

export function parseCurrentReleaseFixtures(
  environment: Record<string, string | undefined> = process.env,
): CurrentReleaseFixtures {
  const result = environmentSchema.safeParse(environment)
  if (!result.success) {
    throw new Error('CURRENT_RELEASE_FIXTURES_INVALID')
  }
  const paths = getCurrentReleasePaths(
    result.data.CURRENT_RELEASE_WORKSPACE_ROOT,
    result.data.CURRENT_RELEASE_RUN_ID,
  )

  return {
    runId: result.data.CURRENT_RELEASE_RUN_ID,
    baseUrl: result.data.CURRENT_RELEASE_BASE_URL,
    userA: result.data.CURRENT_RELEASE_USER_A,
    passwordA: result.data.CURRENT_RELEASE_USER_A_PASSWORD,
    userB: result.data.CURRENT_RELEASE_USER_B,
    passwordB: result.data.CURRENT_RELEASE_USER_B_PASSWORD,
    adminPassword: result.data.ADMIN_PASSWORD,
    acceptanceSecret:
      result.data.CURRENT_RELEASE_ACCEPTANCE_SECRET,
    awsProfile: result.data.AWS_PROFILE,
    awsRegion: result.data.AWS_REGION,
    paths,
    runnerGuard: result.data.CURRENT_RELEASE_RUNNER_GUARD,
    budget: parseChildBudgetContract(
      result.data.CURRENT_RELEASE_BUDGET,
    ),
  }
}
