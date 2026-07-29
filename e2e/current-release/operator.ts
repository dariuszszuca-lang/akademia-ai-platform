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
const COGNITO_PARAMETER_NAME =
  '/property-intelligence-studio/prod/cognito-user-pool-id'
const RESOLVED_CONTEXT = Symbol('resolved-operator-context')

export type AwsCommandResult = {
  ok: boolean
  stdout: string
  errorKind?: 'not-found' | 'transient' | 'failed'
}

export type AwsCommandOptions = {
  timeoutMs: number
  input?: string
}

export type AwsCommandExecutor = {
  execute(
    args: string[],
    options: AwsCommandOptions,
  ): Promise<AwsCommandResult>
  waitBeforeRetry?: (milliseconds: number) => Promise<void>
}

export type OperatorBaseContext = {
  runId: string
  profile: string
  region: string
  accountId: string
}

export type ResolvedOperatorResources = {
  stackName: typeof STACK_NAME
  bucketName: string
  userPoolId: string
  identityParameterName: typeof COGNITO_PARAMETER_NAME
  queueUrl: string
  alarmNames: string[]
}

export type ResolvedOperatorContext = OperatorBaseContext & {
  resources: ResolvedOperatorResources
  [RESOLVED_CONTEXT]: true
}

export type OperatorContext =
  | OperatorBaseContext
  | ResolvedOperatorContext

type ExecuteFile = (
  executable: string,
  args: string[],
  options: {
    encoding: 'utf8'
    stdio: ['pipe', 'pipe', 'pipe']
    timeout: number
    maxBuffer: number
    env: NodeJS.ProcessEnv
    input?: string
  },
) => string

type StackResource = {
  LogicalResourceId: string
  PhysicalResourceId: string
  ResourceType: string
}

export function buildAwsExecutionEnvironment(
  source: Record<string, string | undefined> = process.env,
): NodeJS.ProcessEnv {
  const environment: Record<string, string> = {}
  for (const key of [
    'PATH',
    'HOME',
    'TMPDIR',
    'LANG',
    'LC_ALL',
  ] as const) {
    const value = source[key]?.trim()
    if (value) environment[key] = value
  }
  return {
    ...environment,
    AWS_PROFILE: EXPECTED_PROFILE,
    AWS_REGION: EXPECTED_REGION,
    AWS_DEFAULT_REGION: EXPECTED_REGION,
    AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'true',
  } as unknown as NodeJS.ProcessEnv
}

export function createAwsCommandExecutor(
  runtime: {
    environment?: Record<string, string | undefined>
    executeFile?: ExecuteFile
    waitBeforeRetry?: (milliseconds: number) => Promise<void>
  } = {},
): AwsCommandExecutor {
  const executeFile =
    runtime.executeFile ??
    (execFileSync as unknown as ExecuteFile)
  const environment = buildAwsExecutionEnvironment(
    runtime.environment ?? process.env,
  )
  return {
    async execute(args, options) {
      try {
        const stdout = executeFile('aws', args, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: options.timeoutMs,
          maxBuffer: 10 * 1024 * 1024,
          env: environment,
          input: options.input,
        })
        return { ok: true, stdout }
      } catch (error) {
        const stderr = readCapturedStderr(error)
        return {
          ok: false,
          stdout: '',
          errorKind: classifyAwsFailure(stderr, error),
        }
      }
    },
    waitBeforeRetry:
      runtime.waitBeforeRetry ??
      ((milliseconds) =>
        new Promise((resolve) => {
          setTimeout(resolve, milliseconds)
        })),
  }
}

export async function assertCallerIdentity(
  context: OperatorBaseContext,
  executor: AwsCommandExecutor = createAwsCommandExecutor(),
) {
  validateBaseContext(context)
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
    .passthrough()
    .safeParse(parseJson(result, context.runId))
  if (
    !identity.success ||
    identity.data.Account !== EXPECTED_ACCOUNT ||
    identity.data.Arn !== EXPECTED_CALLER_ARN
  ) {
    throw operatorError('IDENTITY_INVALID', context.runId)
  }
  return {
    Account: identity.data.Account,
    Arn: identity.data.Arn,
  }
}

export async function resolveOperatorContext(
  context: OperatorBaseContext,
  executor: AwsCommandExecutor = createAwsCommandExecutor(),
): Promise<ResolvedOperatorContext> {
  validateBaseContext(context)
  await assertCallerIdentity(context, executor)

  const stack = await resolveSourceStack(context, executor)
  const resources = await listStackResources(
    context,
    STACK_NAME,
    executor,
  )
  const bucket = resources.filter(
    (resource) =>
      resource.ResourceType === 'AWS::S3::Bucket' &&
      resource.PhysicalResourceId === stack.bucketName,
  )
  const queues = resources.filter(
    (resource) =>
      resource.ResourceType === 'AWS::SQS::Queue' &&
      resource.LogicalResourceId.includes('DeadLetterQueue') &&
      isExpectedQueueUrl(resource.PhysicalResourceId),
  )
  const alarmNames = resources
    .filter(
      (resource) =>
        resource.ResourceType === 'AWS::CloudWatch::Alarm' &&
        resource.PhysicalResourceId.trim().length > 0,
    )
    .map((resource) => resource.PhysicalResourceId)
  if (
    bucket.length !== 1 ||
    queues.length !== 1 ||
    alarmNames.length === 0 ||
    new Set(alarmNames).size !== alarmNames.length
  ) {
    throw new Error('CURRENT_RELEASE_SOURCE_RESOURCE_UNVERIFIED')
  }

  const userPoolId = await resolveCognitoUserPool(context, executor)
  return {
    ...context,
    resources: {
      stackName: STACK_NAME,
      bucketName: stack.bucketName,
      userPoolId,
      identityParameterName: COGNITO_PARAMETER_NAME,
      queueUrl: queues[0]!.PhysicalResourceId,
      alarmNames,
    },
    [RESOLVED_CONTEXT]: true,
  }
}

export async function confirmUser(
  context: ResolvedOperatorContext,
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
      context.resources.userPoolId,
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
  context: ResolvedOperatorContext,
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
      '--cli-input-json',
      'file:///dev/stdin',
      '--profile',
      context.profile,
      '--region',
      context.region,
    ],
    executor,
    JSON.stringify({
      UserPoolId: context.resources.userPoolId,
      Username: username,
      TemporaryPassword: password,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: username },
        { Name: 'email_verified', Value: 'true' },
      ],
    }),
  )
  await assertCallerIdentity(context, executor)
  await mutateAws(
    context,
    [
      'cognito-idp',
      'admin-set-user-password',
      '--cli-input-json',
      'file:///dev/stdin',
      '--profile',
      context.profile,
      '--region',
      context.region,
    ],
    executor,
    JSON.stringify({
      UserPoolId: context.resources.userPoolId,
      Username: username,
      Password: password,
      Permanent: true,
    }),
  )
}

export async function deleteUser(
  context: ResolvedOperatorContext,
  username: string,
  executor: AwsCommandExecutor = createAwsCommandExecutor(),
): Promise<void> {
  validateMutation(context, username)
  const result = await executeWithAttempts(
    [
      'cognito-idp',
      'admin-delete-user',
      '--user-pool-id',
      context.resources.userPoolId,
      '--username',
      username,
      '--profile',
      context.profile,
      '--region',
      context.region,
    ],
    executor,
    2,
    undefined,
    () => assertCallerIdentity(context, executor).then(() => undefined),
  )
  if (!result.ok && result.errorKind !== 'not-found') {
    throw operatorError('MUTATION_FAILED', context.runId)
  }
}

export async function getUserSubject(
  context: ResolvedOperatorContext,
  username: string,
  executor: AwsCommandExecutor = createAwsCommandExecutor(),
): Promise<string | null> {
  validateResolvedContext(context)
  validateUsername(context, username)
  await assertCallerIdentity(context, executor)
  const result = await executeWithAttempts(
    [
      'cognito-idp',
      'admin-get-user',
      '--user-pool-id',
      context.resources.userPoolId,
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
    .passthrough()
    .safeParse(parseJson(result.stdout, context.runId))
  const subject = parsed.success
    ? parsed.data.UserAttributes?.find(
        (attribute) => attribute.Name === 'sub',
      )?.Value
    : undefined
  if (!subject) throw operatorError('SUBJECT_MISSING', context.runId)
  return subject
}

export async function checkDlq(
  context: ResolvedOperatorContext,
  executor: AwsCommandExecutor = createAwsCommandExecutor(),
): Promise<number> {
  validateResolvedContext(context)
  await assertCallerIdentity(context, executor)
  const raw = await readAws(
    context,
    [
      'sqs',
      'get-queue-attributes',
      '--queue-url',
      context.resources.queueUrl,
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
    .passthrough()
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
  context: ResolvedOperatorContext,
  executor: AwsCommandExecutor = createAwsCommandExecutor(),
): Promise<number> {
  validateResolvedContext(context)
  await assertCallerIdentity(context, executor)
  const raw = await readAws(
    context,
    [
      'cloudwatch',
      'describe-alarms',
      '--state-value',
      'ALARM',
      '--alarm-names',
      ...context.resources.alarmNames,
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
    .passthrough()
    .safeParse(parseJson(raw, context.runId))
  if (!parsed.success) {
    throw operatorError('ALARMS_RESPONSE_INVALID', context.runId)
  }
  return parsed.data.MetricAlarms?.length ?? 0
}

export async function verifyRunS3Empty(
  context: ResolvedOperatorContext,
  input: {
    organizationPrefix: string
    storageKeys: string[]
  },
  executor: AwsCommandExecutor = createAwsCommandExecutor(),
): Promise<number> {
  validateResolvedContext(context)
  const organizationPrefix = z
    .string()
    .regex(
      /^originals\/organizations\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/$/i,
    )
    .safeParse(input.organizationPrefix)
  if (
    !organizationPrefix.success ||
    input.storageKeys.length > 40 ||
    new Set(input.storageKeys).size !== input.storageKeys.length ||
    input.storageKeys.some(
      (key) =>
        !key.startsWith(organizationPrefix.data) ||
        key.length > 1024 ||
        key.includes('..') ||
        key.endsWith('/'),
    )
  ) {
    throw operatorError('S3_PREFIX_INVALID', context.runId)
  }

  await assertCallerIdentity(context, executor)
  let remaining = 0
  for (const key of input.storageKeys) {
    const result = await executeWithAttempts(
      [
        's3api',
        'list-object-versions',
        '--bucket',
        context.resources.bucketName,
        '--prefix',
        key,
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
        Versions: z
          .array(z.object({ Key: z.string() }).passthrough())
          .optional(),
        DeleteMarkers: z
          .array(z.object({ Key: z.string() }).passthrough())
          .optional(),
      })
      .passthrough()
      .safeParse(parseJson(result.stdout, context.runId))
    if (
      !parsed.success ||
      [...(parsed.data.Versions ?? []), ...(parsed.data.DeleteMarkers ?? [])]
        .some((entry) => entry.Key !== key)
    ) {
      throw operatorError('S3_RESPONSE_INVALID', context.runId)
    }
    remaining +=
      (parsed.data.Versions?.length ?? 0) +
      (parsed.data.DeleteMarkers?.length ?? 0)
  }
  return remaining
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

async function resolveSourceStack(
  context: OperatorBaseContext,
  executor: AwsCommandExecutor,
): Promise<{ bucketName: string }> {
  const raw = await readAws(
    context,
    [
      'cloudformation',
      'describe-stacks',
      '--stack-name',
      STACK_NAME,
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
      Stacks: z
        .array(
          z
            .object({
              StackName: z.string(),
              StackId: z.string(),
              Outputs: z.array(
                z.object({
                  OutputKey: z.string(),
                  OutputValue: z.string(),
                }),
              ),
              Tags: z.array(
                z.object({ Key: z.string(), Value: z.string() }),
              ),
            })
            .passthrough(),
        )
        .length(1),
    })
    .passthrough()
    .safeParse(parseJson(raw, context.runId))
  if (!parsed.success) {
    throw new Error('CURRENT_RELEASE_SOURCE_RESOURCE_UNVERIFIED')
  }
  const stack = parsed.data.Stacks[0]!
  const outputs = new Map(
    stack.Outputs.map((entry) => [entry.OutputKey, entry.OutputValue]),
  )
  const tags = new Map(
    stack.Tags.map((entry) => [entry.Key, entry.Value]),
  )
  const bucketName = outputs.get('PropertySourceBucketName')
  if (
    stack.StackName !== STACK_NAME ||
    !stack.StackId.startsWith(
      `arn:aws:cloudformation:${EXPECTED_REGION}:${EXPECTED_ACCOUNT}:stack/${STACK_NAME}/`,
    ) ||
    !bucketName ||
    outputs.get('PropertySourceRegion') !== EXPECTED_REGION ||
    tags.get('Project') !== 'PropertyIntelligenceStudio' ||
    tags.get('Env') !== 'prod' ||
    tags.get('Owner') !== 'AI-Team' ||
    tags.get('CostCenter') !== 'PropertyStudio'
  ) {
    throw new Error('CURRENT_RELEASE_SOURCE_RESOURCE_UNVERIFIED')
  }
  return { bucketName }
}

async function listStackResources(
  context: OperatorBaseContext,
  stackName: string,
  executor: AwsCommandExecutor,
): Promise<StackResource[]> {
  const raw = await readAws(
    context,
    [
      'cloudformation',
      'list-stack-resources',
      '--stack-name',
      stackName,
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
        z
          .object({
            LogicalResourceId: z.string(),
            PhysicalResourceId: z.string(),
            ResourceType: z.string(),
          })
          .passthrough(),
      ),
    })
    .passthrough()
    .safeParse(parseJson(raw, context.runId))
  if (!parsed.success) {
    throw new Error('CURRENT_RELEASE_SOURCE_RESOURCE_UNVERIFIED')
  }
  return parsed.data.StackResourceSummaries
}

async function resolveCognitoUserPool(
  context: OperatorBaseContext,
  executor: AwsCommandExecutor,
): Promise<string> {
  try {
    const parameterRaw = await readAws(
      context,
      [
        'ssm',
        'get-parameter',
        '--name',
        COGNITO_PARAMETER_NAME,
        '--no-with-decryption',
        '--profile',
        context.profile,
        '--region',
        context.region,
        '--output',
        'json',
      ],
      executor,
    )
    const parameter = z
      .object({
        Parameter: z
          .object({
            Name: z.literal(COGNITO_PARAMETER_NAME),
            Type: z.literal('String'),
            Value: z
              .string()
              .regex(/^eu-central-1_[A-Za-z0-9]+$/),
          })
          .passthrough(),
      })
      .passthrough()
      .parse(parseJson(parameterRaw, context.runId))
    const userPoolId = parameter.Parameter.Value
    const userPoolRaw = await readAws(
      context,
      [
        'cognito-idp',
        'describe-user-pool',
        '--user-pool-id',
        userPoolId,
        '--profile',
        context.profile,
        '--region',
        context.region,
        '--output',
        'json',
      ],
      executor,
    )
    const userPool = z
      .object({
        UserPool: z
          .object({
            Id: z.literal(userPoolId),
            Arn: z.literal(
              `arn:aws:cognito-idp:${EXPECTED_REGION}:${EXPECTED_ACCOUNT}:userpool/${userPoolId}`,
            ),
          })
          .passthrough(),
      })
      .passthrough()
      .parse(parseJson(userPoolRaw, context.runId))
    const tagsRaw = await readAws(
      context,
      [
        'cognito-idp',
        'list-tags-for-resource',
        '--resource-arn',
        userPool.UserPool.Arn,
        '--profile',
        context.profile,
        '--region',
        context.region,
        '--output',
        'json',
      ],
      executor,
    )
    const tags = z
      .object({
        Tags: z
          .record(z.string(), z.string())
          .refine(
            (value) =>
              value.Project === 'PropertyIntelligenceStudio' &&
              value.Env === 'prod',
          ),
      })
      .passthrough()
      .parse(parseJson(tagsRaw, context.runId))
    void tags
    return userPoolId
  } catch {
    throw new Error('CURRENT_RELEASE_COGNITO_RESOURCE_UNVERIFIED')
  }
}

async function readAws(
  context: OperatorBaseContext,
  args: string[],
  executor: AwsCommandExecutor,
): Promise<string> {
  const result = await executeWithAttempts(args, executor, 2)
  if (!result.ok) throw operatorError('READ_FAILED', context.runId)
  return result.stdout
}

async function mutateAws(
  context: OperatorBaseContext,
  args: string[],
  executor: AwsCommandExecutor,
  input?: string,
): Promise<void> {
  const result = await executeWithAttempts(
    args,
    executor,
    1,
    input,
  )
  if (!result.ok) {
    throw operatorError('MUTATION_FAILED', context.runId)
  }
}

async function executeWithAttempts(
  args: string[],
  executor: AwsCommandExecutor,
  maxAttempts: 1 | 2,
  input?: string,
  beforeAttempt?: () => Promise<void>,
): Promise<AwsCommandResult> {
  let result: AwsCommandResult = {
    ok: false,
    stdout: '',
    errorKind: 'failed',
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await beforeAttempt?.()
    result = await executor.execute([...args], {
      timeoutMs: AWS_TIMEOUT_MS,
      input,
    })
    if (result.ok || result.errorKind === 'not-found') return result
    if (
      result.errorKind !== 'transient' ||
      attempt === maxAttempts
    ) {
      return result
    }
    await executor.waitBeforeRetry?.(100)
  }
  return result
}

function validateMutation(
  context: ResolvedOperatorContext,
  username: string,
): void {
  validateResolvedContext(context)
  validateUsername(context, username)
}

function validateBaseContext(context: OperatorBaseContext): void {
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

function validateResolvedContext(
  context: ResolvedOperatorContext,
): void {
  validateBaseContext(context)
  if (
    context[RESOLVED_CONTEXT] !== true ||
    context.resources.stackName !== STACK_NAME ||
    context.resources.identityParameterName !==
      COGNITO_PARAMETER_NAME ||
    !/^eu-central-1_[A-Za-z0-9]+$/.test(
      context.resources.userPoolId,
    ) ||
    !context.resources.bucketName ||
    !isExpectedQueueUrl(context.resources.queueUrl) ||
    context.resources.alarmNames.length === 0
  ) {
    throw operatorError('CONTEXT_INVALID', context.runId)
  }
}

function validateUsername(
  context: OperatorBaseContext,
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

function isExpectedQueueUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === `sqs.${EXPECTED_REGION}.amazonaws.com` &&
      url.pathname.startsWith(`/${EXPECTED_ACCOUNT}/`) &&
      url.username === '' &&
      url.password === ''
    )
  } catch {
    return false
  }
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
  error?: unknown,
): AwsCommandResult['errorKind'] {
  if (
    stderr.includes('UserNotFoundException') ||
    stderr.includes('NoSuchEntity') ||
    stderr.includes('ParameterNotFound')
  ) {
    return 'not-found'
  }
  if (
    isProcessTimeout(error) ||
    stderr.includes('Throttling') ||
    stderr.includes('Timeout') ||
    stderr.includes('temporarily unavailable')
  ) {
    return 'transient'
  }
  return 'failed'
}

function isProcessTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const value = error as {
    code?: unknown
    signal?: unknown
    killed?: unknown
  }
  return (
    value.code === 'ETIMEDOUT' ||
    value.killed === true ||
    value.signal === 'SIGTERM' ||
    value.signal === 'SIGKILL'
  )
}
