import {
  parseSyntheticCleanupRegistry,
  safeDeletionReceiptSchema,
  type SafeDeletionReceipt,
  type SyntheticCleanupRegistry,
} from '../synthetic-acceptance/cleanup-registry'

const PRODUCTION_URL =
  'https://akademia-ai-platform.vercel.app'
const accountKeySuffixes = [
  'profil',
  'persona-buyer',
  'persona-seller',
  'onboarding',
  'subscription',
] as const

export type CurrentReleaseCleanup = {
  databaseEmpty: boolean
  cognitoUsersAbsent: boolean
  kvKeysAbsent: boolean
  s3VersionsRemaining: number
  adminStateRestored: boolean
  dlqMessagesVisible: number
  alarmsNotOk: number
}

export type CurrentReleaseCleanupInput = {
  registry: SyntheticCleanupRegistry
  baseUrl: string
  adminPassword: string
  credentials: Array<{
    role: 'a' | 'b'
    username: string
    password: string
  }>
}

export type CurrentReleaseCleanupDependencies = {
  assertIdentity(): Promise<void>
  getUserSubject(username: string): Promise<string | null>
  deleteAccount(input: {
    role: 'a' | 'b'
    baseUrl: string
    username: string
    password: string
  }): Promise<SafeDeletionReceipt>
  deleteIdentity(username: string): Promise<void>
  persistRegistry(
    registry: SyntheticCleanupRegistry,
  ): Promise<void>
  restoreAdmin(input: {
    baseUrl: string
    adminPassword: string
    previousState: NonNullable<
      SyntheticCleanupRegistry['adminAgentState']
    >
  }): Promise<boolean>
  verifyS3Empty(input: {
    organizationPrefix: string
    storageKeys: string[]
  }): Promise<number>
  checkDlq(): Promise<number>
  checkAlarms(): Promise<number>
  waitUntilEpochSeconds(expiresAt: number): Promise<void>
}

export async function cleanupCurrentRelease(
  input: CurrentReleaseCleanupInput,
  dependencies: CurrentReleaseCleanupDependencies,
): Promise<CurrentReleaseCleanup> {
  try {
    return await cleanupValidatedCurrentRelease(input, dependencies)
  } catch (error) {
    if (
      error instanceof Error &&
      /^CURRENT_RELEASE_CLEANUP_FAILED(?::[A-Z_]+)+$/.test(
        error.message,
      )
    ) {
      throw error
    }
    throw new Error('CURRENT_RELEASE_CLEANUP_FAILED')
  }
}

async function cleanupValidatedCurrentRelease(
  input: CurrentReleaseCleanupInput,
  dependencies: CurrentReleaseCleanupDependencies,
): Promise<CurrentReleaseCleanup> {
  if (
    input.baseUrl !== PRODUCTION_URL ||
    !input.adminPassword.trim()
  ) {
    throw new Error('invalid process context')
  }
  const registry = parseSyntheticCleanupRegistry(input.registry)
  const credentials = validateCredentials(input, registry)
  const finalSubjects = new Map<'a' | 'b', string | null>()
  const failedPhases: string[] = []

  for (const user of [...registry.releaseUsers].reverse()) {
    try {
      const credential = credentials.get(user.role)
      if (!credential) throw new Error('missing credential')
      let subject = await dependencies.getUserSubject(
        user.username,
      )
      let receipt = registry.accountDeletionReceipts.find(
        (candidate) => candidate.role === user.role,
      )

      if (!receipt && subject !== null) {
        await dependencies.assertIdentity()
        const safeReceipt = safeDeletionReceiptSchema.parse(
          await dependencies.deleteAccount({
            role: user.role,
            baseUrl: input.baseUrl,
            username: user.username,
            password: credential.password,
          }),
        )
        receipt = {
          role: user.role,
          ...safeReceipt,
        }
        registry.accountDeletionReceipts.push(receipt)
        input.registry.accountDeletionReceipts =
          registry.accountDeletionReceipts.map((value) => ({
            ...value,
          }))
        await dependencies.persistRegistry(registry)
        subject = await dependencies.getUserSubject(user.username)
      }

      if (receipt && subject !== null) {
        await dependencies.assertIdentity()
        await dependencies.deleteIdentity(user.username)
      }
      finalSubjects.set(
        user.role,
        await dependencies.getUserSubject(user.username),
      )
    } catch {
      failedPhases.push(`ACCOUNT_${user.role.toUpperCase()}`)
    }
  }

  let s3VersionsRemaining = 0
  try {
    if (registry.storageKeys.length > 0) {
      if (!registry.organizationPrefix) {
        throw new Error('missing organization prefix')
      }
      s3VersionsRemaining =
        await dependencies.verifyS3Empty({
          organizationPrefix: registry.organizationPrefix,
          storageKeys: [...registry.storageKeys],
        })
    }
    assertCleanupCount(s3VersionsRemaining)
  } catch {
    failedPhases.push('S3')
  }

  let adminStateRestored = registry.adminAgentState === null
  try {
    if (registry.adminAgentState !== null) {
      await dependencies.assertIdentity()
      adminStateRestored =
        (await dependencies.restoreAdmin({
          baseUrl: input.baseUrl,
          adminPassword: input.adminPassword,
          previousState: registry.adminAgentState,
        })) === true
      if (!adminStateRestored) throw new Error('restore rejected')
    }
  } catch {
    adminStateRestored = false
    failedPhases.push('ADMIN')
  }

  try {
    if (registry.ephemeralStateExpiresAt !== null) {
      await dependencies.waitUntilEpochSeconds(
        registry.ephemeralStateExpiresAt,
      )
    }
  } catch {
    failedPhases.push('TTL')
  }

  let dlqMessagesVisible = 0
  try {
    dlqMessagesVisible = await dependencies.checkDlq()
    assertCleanupCount(dlqMessagesVisible)
  } catch {
    failedPhases.push('DLQ')
  }

  let alarmsNotOk = 0
  try {
    alarmsNotOk = await dependencies.checkAlarms()
    assertCleanupCount(alarmsNotOk)
  } catch {
    failedPhases.push('ALARMS')
  }

  if (failedPhases.length > 0) {
    throw new Error(
      `CURRENT_RELEASE_CLEANUP_FAILED:${failedPhases.join(':')}`,
    )
  }

  const databaseEmpty = hasBothDeletionReceipts(registry)
  return {
    databaseEmpty,
    cognitoUsersAbsent:
      registry.releaseUsers.length === 2 &&
      registry.releaseUsers.every(
        (user) => finalSubjects.get(user.role) === null,
      ),
    kvKeysAbsent:
      databaseEmpty &&
      registry.ephemeralStateExpiresAt !== null &&
      hasExactAccountKeyEvidence(registry),
    s3VersionsRemaining,
    adminStateRestored,
    dlqMessagesVisible,
    alarmsNotOk,
  }
}

function assertCleanupCount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('invalid cleanup count')
  }
}

export async function waitForEphemeralStateExpiry(
  expiresAtEpochSeconds: number,
  runtime: {
    nowMs?: () => number
    sleep?: (milliseconds: number) => Promise<void>
  } = {},
): Promise<void> {
  const nowMs = runtime.nowMs ?? Date.now
  const sleep =
    runtime.sleep ??
    ((milliseconds) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds)
      }))
  if (
    !Number.isSafeInteger(expiresAtEpochSeconds) ||
    expiresAtEpochSeconds <= 0
  ) {
    throw new Error('CURRENT_RELEASE_EPHEMERAL_EXPIRY_INVALID')
  }
  const remainingMs =
    expiresAtEpochSeconds * 1_000 - nowMs()
  if (remainingMs <= 0) return
  if (remainingMs > 70_000) {
    throw new Error('CURRENT_RELEASE_EPHEMERAL_EXPIRY_INVALID')
  }
  await sleep(remainingMs)
  if (nowMs() < expiresAtEpochSeconds * 1_000) {
    throw new Error('CURRENT_RELEASE_EPHEMERAL_EXPIRY_INVALID')
  }
}

function validateCredentials(
  input: CurrentReleaseCleanupInput,
  registry: SyntheticCleanupRegistry,
): Map<
  'a' | 'b',
  CurrentReleaseCleanupInput['credentials'][number]
> {
  if (
    input.credentials.length !== 2 ||
    registry.releaseUsers.length !== 2
  ) {
    throw new Error('invalid credentials')
  }
  const credentials = new Map(
    input.credentials.map((credential) => [
      credential.role,
      credential,
    ]),
  )
  if (credentials.size !== 2) {
    throw new Error('duplicate credentials')
  }
  for (const user of registry.releaseUsers) {
    const credential = credentials.get(user.role)
    if (
      !credential ||
      credential.username !== user.username ||
      credential.password.length < 20 ||
      credential.password.length > 200
    ) {
      throw new Error('credential mismatch')
    }
  }
  return credentials
}

function hasBothDeletionReceipts(
  registry: SyntheticCleanupRegistry,
): boolean {
  return (
    registry.accountDeletionReceipts.length === 2 &&
    (['a', 'b'] as const).every((role) =>
      registry.accountDeletionReceipts.some(
        (receipt) =>
          receipt.role === role &&
          receipt.ok === true &&
          receipt.propertyStudio === 1 &&
          receipt.accountKeys === 5,
      ),
    )
  )
}

function hasExactAccountKeyEvidence(
  registry: SyntheticCleanupRegistry,
): boolean {
  const subjects = registry.releaseUsers.flatMap((user) =>
    user.cognitoSub ? [user.cognitoSub] : [],
  )
  if (subjects.length !== 2) return false
  const expected = new Set(
    subjects.flatMap((subject) =>
      accountKeySuffixes.map(
        (suffix) => `user:${subject}:${suffix}`,
      ),
    ),
  )
  return (
    registry.kvKeys.length === expected.size &&
    registry.kvKeys.every((key) => expected.has(key))
  )
}
