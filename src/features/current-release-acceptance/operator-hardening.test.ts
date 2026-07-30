import {
  existsSync,
  readFileSync,
  statSync,
} from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  assertCallerIdentity,
  buildAwsExecutionEnvironment,
  checkAlarms,
  checkDlq,
  createAwsCommandExecutor,
  createUser,
  deleteUser,
  resolveOperatorContext,
  signInUser,
  verifyRunS3Empty,
  type AwsCommandExecutor,
  type AwsCommandResult,
  type OperatorBaseContext,
} from '../../../e2e/current-release/operator'

const runId = 'syn-20260729T220000Z-deadbeef'
const username = `synthetic-release-${runId}-a@example.invalid`
const password = 'Synthetic-user-A-password-123!'

type FakeCall = {
  args: string[]
  options: {
    timeoutMs: number
    input?: string
  }
}

function baseContext(): OperatorBaseContext {
  return {
    runId,
    profile: 'akademia-ai',
    region: 'eu-central-1',
    accountId: '261965598943',
  }
}

function fakeExecutor(
  responses: AwsCommandResult[],
): AwsCommandExecutor & { calls: FakeCall[]; waits: number[] } {
  const calls: FakeCall[] = []
  const waits: number[] = []
  return {
    calls,
    waits,
    execute: vi.fn(async (args, options) => {
      calls.push({ args: [...args], options: { ...options } })
      const response = responses.shift()
      if (!response) throw new Error('unexpected fake call')
      return response
    }),
    waitBeforeRetry: vi.fn(async (milliseconds) => {
      waits.push(milliseconds)
    }),
  }
}

const validIdentity = JSON.stringify({
  Account: '261965598943',
  Arn: 'arn:aws:iam::261965598943:user/akademia-wojtka-admin-darek',
})

const validSourceStack = JSON.stringify({
  Stacks: [
    {
      StackName: 'PropertySourceStorage-prod',
      StackId:
        'arn:aws:cloudformation:eu-central-1:261965598943:stack/PropertySourceStorage-prod/11111111-1111-4111-8111-111111111111',
      Outputs: [
        {
          OutputKey: 'PropertySourceBucketName',
          OutputValue: 'property-source-prod-261965598943',
        },
        {
          OutputKey: 'PropertySourceRegion',
          OutputValue: 'eu-central-1',
        },
      ],
      Tags: [
        { Key: 'Project', Value: 'PropertyIntelligenceStudio' },
        { Key: 'Env', Value: 'prod' },
        { Key: 'Owner', Value: 'AI-Team' },
        { Key: 'CostCenter', Value: 'PropertyStudio' },
      ],
    },
  ],
})

const validStackResources = JSON.stringify({
  StackResourceSummaries: [
    {
      LogicalResourceId: 'PropertySourceBucket123',
      PhysicalResourceId: 'property-source-prod-261965598943',
      ResourceType: 'AWS::S3::Bucket',
    },
    {
      LogicalResourceId: 'EventDeadLetterQueue123',
      PhysicalResourceId:
        'https://sqs.eu-central-1.amazonaws.com/261965598943/property-source-dlq',
      ResourceType: 'AWS::SQS::Queue',
    },
    {
      LogicalResourceId: 'PipelineAlarm123',
      PhysicalResourceId: 'property-source-pipeline-alarm',
      ResourceType: 'AWS::CloudWatch::Alarm',
    },
  ],
})

const validParameter = JSON.stringify({
  Parameter: {
    Name: '/property-intelligence-studio/prod/cognito-user-pool-id',
    Type: 'String',
    Value: 'eu-central-1_SyntheticPool',
  },
})

const validUserPool = JSON.stringify({
  UserPool: {
    Id: 'eu-central-1_SyntheticPool',
    Arn: 'arn:aws:cognito-idp:eu-central-1:261965598943:userpool/eu-central-1_SyntheticPool',
    Name: 'property-intelligence-studio-prod',
  },
})

const validUserPoolTags = JSON.stringify({
  Tags: {
    Project: 'PropertyIntelligenceStudio',
    Env: 'prod',
  },
})

function resolverResponses(
  overrides: Partial<{
    sourceStack: string
    stackResources: string
    parameter: string
    userPool: string
    userPoolTags: string
  }> = {},
): AwsCommandResult[] {
  return [
    { ok: true, stdout: validIdentity },
    {
      ok: true,
      stdout: overrides.sourceStack ?? validSourceStack,
    },
    {
      ok: true,
      stdout: overrides.stackResources ?? validStackResources,
    },
    {
      ok: true,
      stdout: overrides.parameter ?? validParameter,
    },
    {
      ok: true,
      stdout: overrides.userPool ?? validUserPool,
    },
    {
      ok: true,
      stdout: overrides.userPoolTags ?? validUserPoolTags,
    },
  ]
}

describe('AWS execution environment', () => {
  it('passes only system minimum and exact session profile settings', async () => {
    const environment = buildAwsExecutionEnvironment({
      PATH: '/usr/bin',
      HOME: '/synthetic/home',
      TMPDIR: '/tmp',
      LANG: 'pl_PL.UTF-8',
      AWS_ACCESS_KEY_ID: 'synthetic-access-key',
      AWS_SECRET_ACCESS_KEY: 'synthetic-secret',
      AWS_SESSION_TOKEN: 'synthetic-token',
      AWS_ENDPOINT_URL: 'http://127.0.0.1:9999',
      AWS_ROLE_ARN: 'arn:aws:iam::000000000000:role/wrong',
      STRIPE_SECRET_KEY: 'synthetic-stripe',
    })

    expect(environment).toEqual({
      PATH: '/usr/bin',
      HOME: '/synthetic/home',
      TMPDIR: '/tmp',
      LANG: 'pl_PL.UTF-8',
      AWS_PROFILE: 'akademia-ai',
      AWS_REGION: 'eu-central-1',
      AWS_DEFAULT_REGION: 'eu-central-1',
      AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'true',
    })
  })

  it('uses the sanitized environment in the production wrapper', async () => {
    let capturedEnvironment: NodeJS.ProcessEnv | undefined
    const executor = createAwsCommandExecutor({
      environment: {
        PATH: '/usr/bin',
        HOME: '/synthetic/home',
        AWS_ACCESS_KEY_ID: 'synthetic-access-key',
      },
      executeFile: (_file, _args, options) => {
        capturedEnvironment = options.env
        return '{}'
      },
    })

    await executor.execute(['sts', 'get-caller-identity'], {
      timeoutMs: 30_000,
    })
    expect(capturedEnvironment?.AWS_ACCESS_KEY_ID).toBeUndefined()
    expect(capturedEnvironment?.AWS_PROFILE).toBe('akademia-ai')
  })

  it.each([
    { label: 'success', shouldThrow: false },
    { label: 'process failure', shouldThrow: true },
  ])(
    'uses and removes a private JSON parameter file after $label',
    async ({ shouldThrow }) => {
      const secret = 'synthetic-private-password-123!'
      const payload = JSON.stringify({ Password: secret })
      let capturedArgs: string[] = []
      let capturedInput: string | undefined
      let parameterUri: string | undefined
      let parameterPath: string | undefined
      let directoryPath: string | undefined
      let parameterMode: number | undefined
      let directoryMode: number | undefined
      let parameterContents: string | undefined

      const executor = createAwsCommandExecutor({
        environment: {
          PATH: '/usr/bin',
          HOME: '/synthetic/home',
        },
        executeFile: (_file, args, options) => {
          capturedArgs = [...args]
          capturedInput = options.input
          const parameterIndex = args.indexOf('--cli-input-json')
          parameterUri = args[parameterIndex + 1]

          if (
            parameterUri &&
            parameterUri !== 'file:///dev/stdin' &&
            parameterUri.startsWith('file:')
          ) {
            parameterPath = fileURLToPath(parameterUri)
            directoryPath = dirname(parameterPath)
            parameterMode =
              statSync(parameterPath).mode & 0o777
            directoryMode =
              statSync(directoryPath).mode & 0o777
            parameterContents = readFileSync(
              parameterPath,
              'utf8',
            )
          }

          if (shouldThrow) {
            throw Object.assign(new Error('synthetic failure'), {
              stderr: 'synthetic failure',
            })
          }
          return '{}'
        },
      })

      const result = await executor.execute(
        [
          'cognito-idp',
          'admin-create-user',
          '--cli-input-json',
          'file:///dev/stdin',
        ],
        {
          timeoutMs: 30_000,
          input: payload,
        },
      )

      expect(capturedArgs.join('\0')).not.toContain(secret)
      expect(parameterUri).not.toBe('file:///dev/stdin')
      expect(capturedInput).toBeUndefined()
      expect(parameterMode).toBe(0o600)
      expect(directoryMode).toBe(0o700)
      expect(parameterContents).toBe(payload)
      expect(parameterPath).toBeDefined()
      expect(directoryPath).toBeDefined()
      expect(existsSync(parameterPath!)).toBe(false)
      expect(existsSync(directoryPath!)).toBe(false)
      expect(result.ok).toBe(!shouldThrow)
    },
  )
})

describe('exact operator resource resolution', () => {
  it('resolves bucket and Cognito pool only through exact owned contracts', async () => {
    const executor = fakeExecutor(resolverResponses())
    const context = await resolveOperatorContext(
      baseContext(),
      executor,
    )

    expect(context.resources).toMatchObject({
      stackName: 'PropertySourceStorage-prod',
      bucketName: 'property-source-prod-261965598943',
      userPoolId: 'eu-central-1_SyntheticPool',
      identityParameterName:
        '/property-intelligence-studio/prod/cognito-user-pool-id',
    })
    expect(
      executor.calls.find((call) =>
        call.args.includes('get-parameter'),
      )?.args,
    ).toContain('--no-with-decryption')
  })

  it.each([
    [
      'missing parameter',
      {
        parameter: JSON.stringify({ Parameter: undefined }),
      },
    ],
    [
      'wrong pool account',
      {
        userPool: JSON.stringify({
          UserPool: {
            Id: 'eu-central-1_SyntheticPool',
            Arn: 'arn:aws:cognito-idp:eu-central-1:021655150975:userpool/eu-central-1_SyntheticPool',
            Name: 'wrong',
          },
        }),
      },
    ],
    [
      'wrong tags',
      {
        userPoolTags: JSON.stringify({
          Tags: {
            Project: 'WrongProject',
            Env: 'prod',
          },
        }),
      },
    ],
  ])('rejects unverified Cognito ownership: %s', async (_label, override) => {
    const executor = fakeExecutor(resolverResponses(override))

    await expect(
      resolveOperatorContext(baseContext(), executor),
    ).rejects.toThrow('CURRENT_RELEASE_COGNITO_RESOURCE_UNVERIFIED')
  })

  it('rejects a wrong source stack output before mutation', async () => {
    const wrong = JSON.parse(validSourceStack)
    wrong.Stacks[0].Outputs[0].OutputValue = 'wrong-bucket'
    const executor = fakeExecutor(
      resolverResponses({
        sourceStack: JSON.stringify(wrong),
      }),
    )

    await expect(
      resolveOperatorContext(baseContext(), executor),
    ).rejects.toThrow('CURRENT_RELEASE_SOURCE_RESOURCE_UNVERIFIED')
  })
})

describe('operator execution policies', () => {
  it('keeps passwords out of argv and sends each JSON payload through the secure executor channel once', async () => {
    const resolverExecutor = fakeExecutor(resolverResponses())
    const context = await resolveOperatorContext(
      baseContext(),
      resolverExecutor,
    )
    const operationExecutor = fakeExecutor([
      { ok: true, stdout: validIdentity },
      { ok: true, stdout: '{}' },
      { ok: true, stdout: validIdentity },
      { ok: true, stdout: '{}' },
    ])

    await createUser(
      context,
      username,
      password,
      operationExecutor,
    )

    const mutations = operationExecutor.calls.filter((call) =>
      call.args.some((argument) =>
        ['admin-create-user', 'admin-set-user-password'].includes(
          argument,
        ),
      ),
    )
    expect(mutations).toHaveLength(2)
    for (const call of mutations) {
      expect(call.args.join(' ')).not.toContain(password)
      expect(call.args).toContain('file:///dev/stdin')
      expect(call.options.input).toContain(password)
    }
  })

  it('authenticates the exact synthetic user through the secure AWS JSON channel', async () => {
    const context = await resolveOperatorContext(
      baseContext(),
      fakeExecutor(resolverResponses()),
    )
    const accessToken = 'synthetic-access-token'
    const operationExecutor = fakeExecutor([
      { ok: true, stdout: validIdentity },
      {
        ok: true,
        stdout: JSON.stringify({
          AuthenticationResult: { AccessToken: accessToken },
        }),
      },
    ])

    await expect(
      signInUser(
        context,
        username,
        password,
        'syntheticclient123',
        operationExecutor,
      ),
    ).resolves.toEqual({
      AuthenticationResult: { AccessToken: accessToken },
    })

    const authCall = operationExecutor.calls.find((call) =>
      call.args.includes('initiate-auth'),
    )
    expect(authCall?.args.join(' ')).not.toContain(password)
    expect(authCall?.args).toContain('file:///dev/stdin')
    expect(authCall?.options.input).toContain(password)
    expect(authCall?.options.input).toContain(
      'syntheticclient123',
    )
  })

  it('reasserts identity before the second create-user mutation and stops on identity change', async () => {
    const context = await resolveOperatorContext(
      baseContext(),
      fakeExecutor(resolverResponses()),
    )
    const changedIdentity = JSON.stringify({
      Account: '021655150975',
      Arn: 'arn:aws:iam::021655150975:user/wrong',
    })
    const executor = fakeExecutor([
      { ok: true, stdout: validIdentity },
      { ok: true, stdout: '{}' },
      { ok: true, stdout: changedIdentity },
    ])

    await expect(
      createUser(context, username, password, executor),
    ).rejects.toThrow(
      `CURRENT_RELEASE_OPERATOR_IDENTITY_INVALID:${runId}`,
    )
    expect(
      executor.calls.some((call) =>
        call.args.includes('admin-set-user-password'),
      ),
    ).toBe(false)
  })

  it('rejects an out-of-run username before any mutation call', async () => {
    const context = await resolveOperatorContext(
      baseContext(),
      fakeExecutor(resolverResponses()),
    )
    const operationExecutor = fakeExecutor([])

    await expect(
      createUser(
        context,
        'synthetic-release-syn-20260729T220000Z-feedface-a@example.invalid',
        password,
        operationExecutor,
      ),
    ).rejects.toThrow(
      `CURRENT_RELEASE_OPERATOR_USERNAME_INVALID:${runId}`,
    )
    expect(operationExecutor.calls).toEqual([])
  })

  it('retries only the idempotent delete mutation after a transient failure', async () => {
    const context = await resolveOperatorContext(
      baseContext(),
      fakeExecutor(resolverResponses()),
    )
    const operationExecutor = fakeExecutor([
      { ok: true, stdout: validIdentity },
      { ok: false, stdout: '', errorKind: 'transient' },
      { ok: true, stdout: validIdentity },
      { ok: true, stdout: '{}' },
    ])

    await deleteUser(context, username, operationExecutor)

    expect(
      operationExecutor.calls.filter((call) =>
        call.args.includes('admin-delete-user'),
      ),
    ).toHaveLength(2)
    expect(operationExecutor.waits).toEqual([100])
  })

  it('classifies process timeouts as transient without exposing raw errors', async () => {
    const rawSecret = 'synthetic-timeout-secret'
    const executor = createAwsCommandExecutor({
      environment: { PATH: '/usr/bin', HOME: '/synthetic/home' },
      executeFile: () => {
        throw Object.assign(new Error(rawSecret), {
          code: 'ETIMEDOUT',
          killed: true,
          signal: 'SIGTERM',
          stderr: rawSecret,
        })
      },
      waitBeforeRetry: vi.fn(async () => undefined),
    })

    await expect(
      assertCallerIdentity(baseContext(), executor),
    ).rejects.toThrow(
      `CURRENT_RELEASE_OPERATOR_READ_FAILED:${runId}`,
    )
    expect(
      vi.mocked(executor.waitBeforeRetry!).mock.calls,
    ).toEqual([[100]])
  })

  it('retries reads only for transient errors with bounded injected backoff', async () => {
    const permanent = fakeExecutor([
      { ok: false, stdout: '', errorKind: 'failed' },
    ])
    await expect(
      assertCallerIdentity(baseContext(), permanent),
    ).rejects.toThrow()
    expect(permanent.calls).toHaveLength(1)
    expect(permanent.waits).toEqual([])

    const transient = fakeExecutor([
      { ok: false, stdout: '', errorKind: 'transient' },
      { ok: true, stdout: validIdentity },
    ])
    await expect(
      assertCallerIdentity(baseContext(), transient),
    ).resolves.toMatchObject({ Account: '261965598943' })
    expect(transient.calls).toHaveLength(2)
    expect(transient.waits).toEqual([100])
  })

  it('checks exact registered S3 keys and rejects substring prefixes', async () => {
    const resolverExecutor = fakeExecutor(resolverResponses())
    const context = await resolveOperatorContext(
      baseContext(),
      resolverExecutor,
    )
    const operationExecutor = fakeExecutor([
      { ok: true, stdout: validIdentity },
      {
        ok: true,
        stdout: JSON.stringify({
          Versions: [],
          DeleteMarkers: [],
        }),
      },
    ])
    const organizationId =
      '33333333-3333-4333-8333-333333333333'
    const storageKey =
      `originals/organizations/${organizationId}/source.pdf`

    await expect(
      verifyRunS3Empty(
        context,
        {
          organizationId,
          organizationPrefix:
            `originals/organizations/${organizationId}/`,
          storageKeys: [storageKey],
        },
        operationExecutor,
      ),
    ).resolves.toBe(0)
    await expect(
      verifyRunS3Empty(
        context,
        {
          organizationId,
          organizationPrefix: `wrong/${runId}/`,
          storageKeys: [`wrong/${runId}/source.pdf`],
        },
        fakeExecutor([]),
      ),
    ).rejects.toThrow(
      `CURRENT_RELEASE_OPERATOR_S3_PREFIX_INVALID:${runId}`,
    )
  })

  it('lists the entire exact organization prefix even when no storage keys were registered', async () => {
    const context = await resolveOperatorContext(
      baseContext(),
      fakeExecutor(resolverResponses()),
    )
    const organizationId =
      '33333333-3333-4333-8333-333333333333'
    const organizationPrefix =
      `originals/organizations/${organizationId}/`
    const executor = fakeExecutor([
      { ok: true, stdout: validIdentity },
      {
        ok: true,
        stdout: JSON.stringify({
          Versions: [],
          DeleteMarkers: [],
        }),
      },
    ])

    await expect(
      verifyRunS3Empty(
        context,
        {
          organizationId,
          organizationPrefix,
          storageKeys: [],
        },
        executor,
      ),
    ).resolves.toBe(0)

    const listCall = executor.calls.find((call) =>
      call.args.includes('list-object-versions'),
    )
    expect(listCall?.args).toContain(organizationPrefix)
    expect(
      executor.calls.filter((call) =>
        call.args.includes('list-object-versions'),
      ),
    ).toHaveLength(1)
  })

  it('fails closed on unregistered residue anywhere under the organization prefix', async () => {
    const context = await resolveOperatorContext(
      baseContext(),
      fakeExecutor(resolverResponses()),
    )
    const organizationId =
      '33333333-3333-4333-8333-333333333333'
    const organizationPrefix =
      `originals/organizations/${organizationId}/`
    const registeredKey = `${organizationPrefix}source.pdf`
    const executor = fakeExecutor([
      { ok: true, stdout: validIdentity },
      {
        ok: true,
        stdout: JSON.stringify({
          Versions: [
            { Key: registeredKey },
            { Key: `${organizationPrefix}unregistered.pdf` },
          ],
          DeleteMarkers: [],
        }),
      },
    ])

    await expect(
      verifyRunS3Empty(
        context,
        {
          organizationId,
          organizationPrefix,
          storageKeys: [registeredKey],
        },
        executor,
      ),
    ).rejects.toThrow(
      `CURRENT_RELEASE_OPERATOR_S3_UNREGISTERED_RESIDUE:${runId}`,
    )
  })

  it('counts visible, in-flight and delayed DLQ messages and rejects partial evidence', async () => {
    const context = await resolveOperatorContext(
      baseContext(),
      fakeExecutor(resolverResponses()),
    )
    const complete = fakeExecutor([
      { ok: true, stdout: validIdentity },
      {
        ok: true,
        stdout: JSON.stringify({
          Attributes: {
            ApproximateNumberOfMessages: '0',
            ApproximateNumberOfMessagesNotVisible: '1',
            ApproximateNumberOfMessagesDelayed: '2',
          },
        }),
      },
    ])

    await expect(checkDlq(context, complete)).resolves.toBe(3)

    const partial = fakeExecutor([
      { ok: true, stdout: validIdentity },
      {
        ok: true,
        stdout: JSON.stringify({
          Attributes: {
            ApproximateNumberOfMessages: '0',
          },
        }),
      },
    ])
    await expect(checkDlq(context, partial)).rejects.toThrow(
      `CURRENT_RELEASE_OPERATOR_DLQ_RESPONSE_INVALID:${runId}`,
    )
  })

  it('requires the exact alarm set and counts every state other than OK', async () => {
    const context = await resolveOperatorContext(
      baseContext(),
      fakeExecutor(resolverResponses()),
    )
    const complete = fakeExecutor([
      { ok: true, stdout: validIdentity },
      {
        ok: true,
        stdout: JSON.stringify({
          MetricAlarms: [
            {
              AlarmName: 'property-source-pipeline-alarm',
              StateValue: 'OK',
            },
          ],
        }),
      },
    ])

    await expect(checkAlarms(context, complete)).resolves.toBe(0)
    expect(
      complete.calls.find((call) =>
        call.args.includes('describe-alarms'),
      )?.args,
    ).not.toContain('--state-value')

    const missing = fakeExecutor([
      { ok: true, stdout: validIdentity },
      {
        ok: true,
        stdout: JSON.stringify({ MetricAlarms: [] }),
      },
    ])
    await expect(checkAlarms(context, missing)).rejects.toThrow(
      `CURRENT_RELEASE_OPERATOR_ALARMS_RESPONSE_INVALID:${runId}`,
    )
  })
})
