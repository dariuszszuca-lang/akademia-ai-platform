import {
  mkdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { z } from 'zod'
import { runIdSchema } from './domain'

const uuidSchema = z.string().uuid()
export const cognitoSubjectSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'SYNTHETIC_COGNITO_SUB_INVALID',
  )

const releaseUserSchema = z
  .object({
    role: z.enum(['a', 'b']),
    username: z.string().max(180),
    cognitoSub: cognitoSubjectSchema.nullable(),
  })
  .strict()

const adminAgentStateSchema = z
  .object({
    agentId: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z][a-z0-9-]*$/),
    enabled: z.boolean(),
  })
  .strict()

const releaseKvSuffixes = [
  'profil',
  'persona-buyer',
  'persona-seller',
  'onboarding',
  'subscription',
] as const

const cleanupRegistrySchema = z
  .object({
    runId: runIdSchema,
    username: z.string().max(160),
    cognitoSub: cognitoSubjectSchema.nullable(),
    organizationId: uuidSchema.nullable(),
    organizationPrefix: z.string().max(240).nullable(),
    projectIds: z.array(uuidSchema),
    sourceIds: z.array(uuidSchema),
    storageKeys: z.array(z.string().min(1).max(1024)),
    releaseUsers: z.array(releaseUserSchema).max(2).default([]),
    kvKeys: z
      .array(z.string().min(1).max(512))
      .max(20)
      .default([]),
    adminAgentState: adminAgentStateSchema.nullable().default(null),
    startedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((registry, context) => {
    const expectedUsername =
      `synthetic-acceptance-${registry.runId}@example.invalid`
    if (registry.username !== expectedUsername) {
      context.addIssue({
        code: 'custom',
        path: ['username'],
        message: 'SYNTHETIC_CLEANUP_USERNAME_INVALID',
      })
    }

    const expectedPrefix = registry.organizationId
      ? `originals/organizations/${registry.organizationId}/`
      : null
    if (registry.organizationPrefix !== expectedPrefix) {
      context.addIssue({
        code: 'custom',
        path: ['organizationPrefix'],
        message: 'SYNTHETIC_CLEANUP_PREFIX_INVALID',
      })
    }
    if (
      expectedPrefix &&
      registry.storageKeys.some(
        (storageKey) => !storageKey.startsWith(expectedPrefix),
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['storageKeys'],
        message: 'SYNTHETIC_CLEANUP_STORAGE_KEY_INVALID',
      })
    }

    const releaseRoles = registry.releaseUsers.map((user) => user.role)
    if (new Set(releaseRoles).size !== releaseRoles.length) {
      context.addIssue({
        code: 'custom',
        path: ['releaseUsers'],
        message: 'SYNTHETIC_RELEASE_ROLE_DUPLICATE',
      })
    }

    const cognitoSubjects = registry.releaseUsers.flatMap((user) =>
      user.cognitoSub ? [user.cognitoSub] : [],
    )
    if (
      new Set(cognitoSubjects).size !== cognitoSubjects.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['releaseUsers'],
        message: 'SYNTHETIC_RELEASE_SUBJECT_DUPLICATE',
      })
    }

    for (const [index, user] of registry.releaseUsers.entries()) {
      const expectedReleaseUsername =
        `synthetic-release-${registry.runId}-${user.role}@example.invalid`
      if (user.username !== expectedReleaseUsername) {
        context.addIssue({
          code: 'custom',
          path: ['releaseUsers', index, 'username'],
          message: 'SYNTHETIC_RELEASE_USERNAME_INVALID',
        })
      }
    }

    const allowedKvKeys = new Set(
      cognitoSubjects.flatMap((subject) =>
        releaseKvSuffixes.map(
          (suffix) => `user:${subject}:${suffix}`,
        ),
      ),
    )
    if (
      registry.kvKeys.some((kvKey) => !allowedKvKeys.has(kvKey))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['kvKeys'],
        message: 'SYNTHETIC_RELEASE_KV_KEY_INVALID',
      })
    }
    if (new Set(registry.kvKeys).size !== registry.kvKeys.length) {
      context.addIssue({
        code: 'custom',
        path: ['kvKeys'],
        message: 'SYNTHETIC_RELEASE_KV_KEY_DUPLICATE',
      })
    }
  })

export type SyntheticCleanupRegistry = z.infer<
  typeof cleanupRegistrySchema
>

export function createSyntheticCleanupRegistry({
  runId,
  startedAt,
}: {
  runId: string
  startedAt: string
}): SyntheticCleanupRegistry {
  return cleanupRegistrySchema.parse({
    runId,
    username: `synthetic-acceptance-${runId}@example.invalid`,
    cognitoSub: null,
    organizationId: null,
    organizationPrefix: null,
    projectIds: [],
    sourceIds: [],
    storageKeys: [],
    releaseUsers: [],
    kvKeys: [],
    adminAgentState: null,
    startedAt,
  })
}

export function saveSyntheticCleanupRegistry(
  workspaceRoot: string,
  registry: SyntheticCleanupRegistry,
): Promise<string> {
  const parsed = parseRegistry(registry)
  return writeRegistry(workspaceRoot, parsed)
}

export function removeSyntheticCleanupRegistry(
  workspaceRoot: string,
  runId: string,
): Promise<void> {
  const path = registryPath(workspaceRoot, runId)
  return rm(path, { force: true })
}

function parseRegistry(
  registry: SyntheticCleanupRegistry,
): SyntheticCleanupRegistry {
  const result = cleanupRegistrySchema.safeParse(registry)
  if (!result.success) {
    throw new Error(
      result.error.issues[0]?.message ??
        'SYNTHETIC_CLEANUP_REGISTRY_INVALID',
    )
  }
  return result.data
}

async function writeRegistry(
  workspaceRoot: string,
  registry: SyntheticCleanupRegistry,
) {
  const path = registryPath(workspaceRoot, registry.runId)
  const directory = resolve(path, '..')
  const temporaryPath = `${path}.${process.pid}.tmp`
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await writeFile(
    temporaryPath,
    `${JSON.stringify(registry, null, 2)}\n`,
    { mode: 0o600 },
  )
  await rename(temporaryPath, path)
  return path
}

function registryPath(workspaceRoot: string, runId: string) {
  const parsedRunId = runIdSchema.parse(runId)
  const directory = resolve(
    workspaceRoot,
    'reports',
    'synthetic-acceptance',
  )
  const path = join(directory, `${parsedRunId}.run.json`)
  if (
    basename(path) !== `${parsedRunId}.run.json` ||
    basename(directory) !== 'synthetic-acceptance'
  ) {
    throw new Error('SYNTHETIC_CLEANUP_PATH_INVALID')
  }
  return path
}
