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
    if (
      input.baseUrl !== PRODUCTION_URL ||
      !input.adminPassword.trim()
    ) {
      throw new Error('invalid process context')
    }
    const registry = parseSyntheticCleanupRegistry(input.registry)
    Object.assign(input.registry, registry)
    const credentials = validateCredentials(input, registry)
    const finalSubjects = new Map<'a' | 'b', string | null>()

    for (const user of [...registry.releaseUsers].reverse()) {
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
          registry.accountDeletionReceipts
        await dependencies.persistRegistry(input.registry)
        subject = await dependencies.getUserSubject(user.username)
      }

      if (receipt && subject !== null) {
        await dependencies.assertIdentity()
        await dependencies.deleteIdentity(user.username)
      }
      const verifiedSubject =
        await dependencies.getUserSubject(user.username)
      finalSubjects.set(user.role, verifiedSubject)
    }

    const databaseEmpty = hasBothDeletionReceipts(registry)
    const kvKeysAbsent =
      databaseEmpty &&
      registry.ephemeralStateExpiresAt !== null &&
      hasExactAccountKeyEvidence(registry)
    const cognitoUsersAbsent =
      registry.releaseUsers.length === 2 &&
      registry.releaseUsers.every(
        (user) => finalSubjects.get(user.role) === null,
      )

    let s3VersionsRemaining = 0
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

    let adminStateRestored = true
    if (registry.adminAgentState !== null) {
      await dependencies.assertIdentity()
      adminStateRestored =
        (await dependencies.restoreAdmin({
          baseUrl: input.baseUrl,
          adminPassword: input.adminPassword,
          previousState: registry.adminAgentState,
        })) === true
    }

    if (registry.ephemeralStateExpiresAt !== null) {
      await dependencies.waitUntilEpochSeconds(
        registry.ephemeralStateExpiresAt,
      )
    }

    const dlqMessagesVisible = await dependencies.checkDlq()
    const alarmsNotOk = await dependencies.checkAlarms()
    if (
      !Number.isInteger(s3VersionsRemaining) ||
      s3VersionsRemaining < 0 ||
      !Number.isInteger(dlqMessagesVisible) ||
      dlqMessagesVisible < 0 ||
      !Number.isInteger(alarmsNotOk) ||
      alarmsNotOk < 0
    ) {
      throw new Error('invalid cleanup count')
    }

    return {
      databaseEmpty,
      cognitoUsersAbsent,
      kvKeysAbsent,
      s3VersionsRemaining,
      adminStateRestored,
      dlqMessagesVisible,
      alarmsNotOk,
    }
  } catch {
    throw new Error('CURRENT_RELEASE_CLEANUP_FAILED')
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
