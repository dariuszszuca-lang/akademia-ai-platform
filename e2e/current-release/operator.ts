import { execFileSync } from 'node:child_process'
import { z } from 'zod'
import { currentReleaseRunIdSchema } from '../../src/features/current-release-acceptance/domain'

const EXPECTED_ACCOUNT = '261965598943'
const EXPECTED_REGION = 'eu-central-1'
const EXPECTED_PROFILE = 'akademia-ai'
const EXPECTED_CALLER_ARN =
  'arn:aws:iam::261965598943:user/akademia-wojtka-admin-darek'
const AWS_TIMEOUT_MS = 30_000
const HTTP_TIMEOUT_MS = 30_000
const STACK_NAME = 'PropertySourceStorage-prod'

export type AwsCommandResult = {
  ok: boolean
  stdout: string
  errorKind?: 'not-found' | 'transient' | 'failed'
}

export type AwsCommandExecutor = {
  execute(
    args: string[],
    options: { timeoutMs: number },
  ): Promise<AwsCommandResult>
}

export type OperatorContext = {
  runId: string
  profile: string
  region: string
  accountId: string
  userPoolId?: string
  stackName?: string
  bucketName?: string
}

type StackResource = {
  LogicalResourceId: string
  PhysicalResourceId: string
  ResourceType: string
}

export function createAwsCommandExecutor(): AwsCommandExecutor {
  return {
    async execute(args, options) {
      try {
        const stdout = execFileSync('aws', args, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: options.timeoutMs,
          maxBuffer: 10 * 1024 * 1024,
        })
        return { ok: true, stdout }
      } catch (error) {
        const stderr = readCapturedStderr(error)
        return {
          ok: false,
          stdout: '',
          errorKind: classifyAwsFailure(stderr),
        }
      }
    },
  }
}

export async function assertCallerIdentity(
  context: OperatorContext,
  executor: AwsCommandExecutor = createAwsCommandExecutor(),
) {
  validateContext(context)
  const result = await readAws(
    context,
    [
      'sts',
      'get-caller-identity',
      '--profile',
      context.profile,
      '--region',
      context.region,
      '--output',
      'json',
    ],
    executor,
  )
  const identity = z
    .object({ Account: z.string(), Arn: z.string() })
    .safeParse(parseJson(result, context.runId))
  if (
    !identity.success ||
    identity.data.Account !== EXPECTED_ACCOUNT ||
    identity.data.Arn !== EXPECTED_CALLER_ARN
  ) {
    throw operatorError('IDENTITY_INVALID', context.runId)
  }
  return identity.data
}

export async function confirmUser(
  context: OperatorContext,
  username: string,
  executor: AwsCommandExecutor = createAwsCommandExecutor(),
): Promise<void> {
  validateMutation(context, username)
  await assertCallerIdentity(context, executor)
  await mutateAws(
    context,
    [
      'cognito-idp',
      'admin-confirm-sign-up',
      '--user-pool-id',
      requireUserPoolId(context),
      '--username',
      username,
      '--profile',
      context.profile,
      '--region',
      context.region,
    ],
    executor,
  )
}

export async function createUser(
  context: OperatorContext,
  username: string,
  password: string,
  executor: AwsCommandExecutor = createAwsCommandExecutor(),
): Promise<void> {
  validateMutation(context, username)
  validatePassword(context.runId, password)
  await assertCallerIdentity(context, executor)

  await mutateAws(
    context,
    [
      'cognito-idp',
      'admin-create-user',
      '--user-pool-id',
      requireUserPoolId(context),
      '--username',
      username,
      '--temporary-password',
      password,
      '--message-action',
      'SUPPRESS',
      '--user-attributes',
      `Name=email,Value=${username}`,
      'Name=email_verified,Value=true',
      '--profile',
      context.profile,
      '--region',
      context.region,
    ],
    executor,
  )
  await mutateAws(
    context,
    [
      'cognito-idp',
      'admin-set-user-password',
      '--user-pool-id',
      requireUserPoolId(context),
      '--username',
      username,
      '--password',
      password,
      '--permanent',
      '--profile',
      context.profile,
      '--region',
      context.region,
    ],
    executor,
  )
}

export async function deleteUser(
  context: OperatorContext,
  username: string,
  executor: AwsCommandExecutor = createAwsCommandExecutor(),
): Promise<void> {
  validateMutation(context, username)
  await assertCallerIdentity(context, executor)
  const result = await executeWithAttempts(
    [
      'cognito-idp',
      'admin-delete-user',
      '--user-pool-id',
      requireUserPoolId(context),
      '--username',
      username,
      '--profile',
      context.profile,
      '--region',
      context.region,
    ],
    executor,
    2,
  )
  if (!result.ok && result.errorKind !== 'not-found') {
    throw operatorError('MUTATION_FAILED', context.runId)
  }
}

export async function getUserSubject(
  context: OperatorContext,
  username: string,
  executor: AwsCommandExecutor = createAwsCommandExecutor(),
): Promise<string | null> {
  validateUsername(context, username)
  await assertCallerIdentity(context, executor)
  const result = await executeWithAttempts(
    [
      'cognito-idp',
      'admin-get-user',
      '--user-pool-id',
      requireUserPoolId(context),
      '--username',
      username,
      '--profile',
      context.profile,
      '--region',
      context.region,
      '--output',
      'json',
    ],
    executor,
    2,
  )
  if (!result.ok && result.errorKind === 'not-found') return null
  if (!result.ok) throw operatorError('READ_FAILED', context.runId)

  const parsed = z
    .object({
      UserAttributes: z
        .array(z.object({ Name: z.string(), Value: z.string() }))
        .optional(),
    })
    .safeParse(parseJson(result.stdout, context.runId))
  const subject = parsed.success
    ? parsed.data.UserAttributes?.find(
        (attribute) => attribute.Name === 'sub',
      )?.Value
    : undefined
  if (!subject) {
    throw operatorError('SUBJECT_MISSING', context.runId)
  }
  return subject
}

export async function checkDlq(
  context: OperatorContext,
  executor: AwsCommandExecutor = createAwsCommandExecutor(),
): Promise<number> {
  validateContext(context)
  const resources = await listStackResources(context, executor)
  const queue = resources.find(
    (resource) =>
      resource.ResourceType === 'AWS::SQS::Queue' &&
      resource.LogicalResourceId.includes('DeadLetterQueue'),
  )
  if (!queue) throw operatorError('DLQ_NOT_FOUND', context.runId)
  const raw = await readAws(
    context,
    [
      'sqs',
      'get-queue-attributes',
      '--queue-url',
      queue.PhysicalResourceId,
      '--attribute-names',
      'ApproximateNumberOfMessages',
      '--profile',
      context.profile,
      '--region',
      context.region,
      '--output',
      'json',
    ],
    executor,
  )
  const parsed = z
    .object({
      Attributes: z
        .object({ ApproximateNumberOfMessages: z.string().optional() })
        .optional(),
    })
    .safeParse(parseJson(raw, context.runId))
  const count = Number(
    parsed.success
      ? parsed.data.Attributes?.ApproximateNumberOfMessages ?? '0'
      : Number.NaN,
  )
  if (!Number.isInteger(count) || count < 0) {
    throw operatorError('DLQ_RESPONSE_INVALID', context.runId)
  }
  return count
}

export async function checkAlarms(
  context: OperatorContext,
  executor: AwsCommandExecutor = createAwsCommandExecutor(),
): Promise<number> {
  validateContext(context)
  const resources = await listStackResources(context, executor)
  const alarmNames = resources
    .filter(
      (resource) =>
        resource.ResourceType === 'AWS::CloudWatch::Alarm',
    )
    .map((resource) => resource.PhysicalResourceId)
  if (alarmNames.length === 0) {
    throw operatorError('ALARMS_NOT_FOUND', context.runId)
  }
  const raw = await readAws(
    context,
    [
      'cloudwatch',
      'describe-alarms',
      '--state-value',
      'ALARM',
      '--alarm-names',
      ...alarmNames,
      '--profile',
      context.profile,
      '--region',
      context.region,
      '--output',
      'json',
    ],
    executor,
  )
  const parsed = z
    .object({ MetricAlarms: z.array(z.unknown()).optional() })
    .safeParse(parseJson(raw, context.runId))
  if (!parsed.success) {
    throw operatorError('ALARMS_RESPONSE_INVALID', context.runId)
  }
  return parsed.data.MetricAlarms?.length ?? 0
}

export async function verifyRunS3Empty(
  context: OperatorContext,
  prefix: string,
  executor: AwsCommandExecutor = createAwsCommandExecutor(),
): Promise<number> {
  validateContext(context)
  if (
    !prefix.includes(context.runId) ||
    prefix.startsWith('/') ||
    prefix.includes('..') ||
    prefix.length > 1024
  ) {
    throw operatorError('S3_PREFIX_INVALID', context.runId)
  }
  const bucketName = context.bucketName?.trim()
  if (!bucketName) {
    throw operatorError('BUCKET_MISSING', context.runId)
  }
  const result = await executeWithAttempts(
    [
      's3api',
      'list-object-versions',
      '--bucket',
      bucketName,
      '--prefix',
      prefix,
      '--profile',
      context.profile,
      '--region',
      context.region,
      '--output',
      'json',
    ],
    executor,
    2,
  )
  if (!result.ok) throw operatorError('READ_FAILED', context.runId)
  const parsed = z
    .object({
      Versions: z.array(z.unknown()).optional(),
      DeleteMarkers: z.array(z.unknown()).optional(),
    })
    .safeParse(parseJson(result.stdout, context.runId))
  if (!parsed.success) {
    throw operatorError('S3_RESPONSE_INVALID', context.runId)
  }
  return (
    (parsed.data.Versions?.length ?? 0) +
    (parsed.data.DeleteMarkers?.length ?? 0)
  )
}

export async function readOperatorJson(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  const parsedUrl = new URL(url)
  if (
    parsedUrl.origin !==
      'https://akademia-ai-platform.vercel.app' ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error('CURRENT_RELEASE_OPERATOR_HTTP_URL_INVALID')
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetcher(url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      })
      if (!response.ok) {
        if (attempt === 2) {
          throw new Error('CURRENT_RELEASE_OPERATOR_HTTP_READ_FAILED')
        }
        continue
      }
      return await response.json()
    } catch {
      if (attempt === 2) {
        throw new Error('CURRENT_RELEASE_OPERATOR_HTTP_READ_FAILED')
      }
    }
  }
  throw new Error('CURRENT_RELEASE_OPERATOR_HTTP_READ_FAILED')
}

async function listStackResources(
  context: OperatorContext,
  executor: AwsCommandExecutor,
): Promise<StackResource[]> {
  const raw = await readAws(
    context,
    [
      'cloudformation',
      'list-stack-resources',
      '--stack-name',
      context.stackName ?? STACK_NAME,
      '--profile',
      context.profile,
      '--region',
      context.region,
      '--output',
      'json',
    ],
    executor,
  )
  const parsed = z
    .object({
      StackResourceSummaries: z.array(
        z.object({
          LogicalResourceId: z.string(),
          PhysicalResourceId: z.string(),
          ResourceType: z.string(),
        }),
      ),
    })
    .safeParse(parseJson(raw, context.runId))
  if (!parsed.success) {
    throw operatorError('STACK_RESPONSE_INVALID', context.runId)
  }
  return parsed.data.StackResourceSummaries
}

async function readAws(
  context: OperatorContext,
  args: string[],
  executor: AwsCommandExecutor,
): Promise<string> {
  const result = await executeWithAttempts(args, executor, 2)
  if (!result.ok) throw operatorError('READ_FAILED', context.runId)
  return result.stdout
}

async function mutateAws(
  context: OperatorContext,
  args: string[],
  executor: AwsCommandExecutor,
): Promise<void> {
  const result = await executeWithAttempts(args, executor, 1)
  if (!result.ok) {
    throw operatorError('MUTATION_FAILED', context.runId)
  }
}

async function executeWithAttempts(
  args: string[],
  executor: AwsCommandExecutor,
  maxAttempts: 1 | 2,
): Promise<AwsCommandResult> {
  let result: AwsCommandResult = {
    ok: false,
    stdout: '',
    errorKind: 'failed',
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    result = await executor.execute([...args], {
      timeoutMs: AWS_TIMEOUT_MS,
    })
    if (result.ok || result.errorKind === 'not-found') return result
  }
  return result
}

function validateMutation(
  context: OperatorContext,
  username: string,
): void {
  validateContext(context)
  validateUsername(context, username)
  requireUserPoolId(context)
}

function validateContext(context: OperatorContext): void {
  const runId = currentReleaseRunIdSchema.safeParse(context.runId)
  if (!runId.success) {
    throw new Error('CURRENT_RELEASE_OPERATOR_RUN_ID_INVALID')
  }
  if (
    context.accountId !== EXPECTED_ACCOUNT ||
    context.profile !== EXPECTED_PROFILE ||
    context.region !== EXPECTED_REGION
  ) {
    throw operatorError('CONTEXT_INVALID', context.runId)
  }
}

function validateUsername(
  context: OperatorContext,
  username: string,
): void {
  const allowed = new Set([
    `synthetic-release-${context.runId}-a@example.invalid`,
    `synthetic-release-${context.runId}-b@example.invalid`,
  ])
  if (!allowed.has(username)) {
    throw operatorError('USERNAME_INVALID', context.runId)
  }
}

function validatePassword(runId: string, password: string): void {
  if (
    password.length < 20 ||
    password.length > 200 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password) ||
    /\s/.test(password)
  ) {
    throw operatorError('PASSWORD_INVALID', runId)
  }
}

function requireUserPoolId(context: OperatorContext): string {
  const userPoolId = context.userPoolId?.trim()
  if (!userPoolId || !/^[\w-]+_[A-Za-z0-9]+$/.test(userPoolId)) {
    throw operatorError('USER_POOL_MISSING', context.runId)
  }
  return userPoolId
}

function parseJson(value: string, runId: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    throw operatorError('JSON_INVALID', runId)
  }
}

function operatorError(code: string, runId: string): Error {
  return new Error(`CURRENT_RELEASE_OPERATOR_${code}:${runId}`)
}

function readCapturedStderr(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'stderr' in error &&
    (typeof error.stderr === 'string' ||
      Buffer.isBuffer(error.stderr))
  ) {
    return String(error.stderr)
  }
  return ''
}

function classifyAwsFailure(
  stderr: string,
): AwsCommandResult['errorKind'] {
  if (
    stderr.includes('UserNotFoundException') ||
    stderr.includes('NoSuchEntity')
  ) {
    return 'not-found'
  }
  if (
    stderr.includes('Throttling') ||
    stderr.includes('Timeout') ||
    stderr.includes('temporarily unavailable')
  ) {
    return 'transient'
  }
  return 'failed'
}
