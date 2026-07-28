import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { resolveFactDefinition } from '../property-sources/catalog'
import type {
  PropertyFactProposal,
  PropertySource,
  SourceProcessingJob,
} from '../property-sources/domain'
import type { PropertyProject } from '../properties/domain'
import {
  removeSyntheticCleanupRegistry,
  saveSyntheticCleanupRegistry,
  type SyntheticCleanupRegistry,
} from './cleanup-registry'
import { runIdSchema } from './domain'
import { generateSyntheticCorpus } from './generator'
import { syntheticCorpus } from './manifest'
import {
  PRODUCTION_SYNTHETIC_BASE_URL,
  type ProductionSyntheticDependencies,
  type ProductionSyntheticOptions,
} from './production-runner'
import {
  serializeSafeReport,
  type SafeSyntheticAcceptanceReport,
} from './report'
import type {
  SyntheticJobObservation,
  SyntheticObservation,
} from './scorer'

const STACK_NAME = 'PropertySourceStorage-prod'
const TERMINAL_SOURCE_STATUSES = new Set([
  'review_ready',
  'completed',
  'failed',
])
const SOURCE_POLL_INTERVAL_MS = 5_000
const SOURCE_POLL_TIMEOUT_MS = 10 * 60_000
const COST_STOP_BEFORE_USD = 2.5

type StackResource = {
  LogicalResourceId: string
  PhysicalResourceId: string
  ResourceType: string
}

type AccountExport = {
  propertyStudio: {
    sourceJobs: SourceProcessingJob[]
    factProposals: PropertyFactProposal[]
  }
}

export function createDefaultProductionSyntheticDependencies(
  options: ProductionSyntheticOptions,
): ProductionSyntheticDependencies {
  let stackResources: StackResource[] | null = null
  let bucketName: string | null = null

  const awsJson = <T>(args: string[]): T =>
    runAwsJson<T>(options.profile, options.region, args)
  const awsText = (args: string[]) =>
    runAwsText([
      '--profile',
      options.profile,
      '--region',
      options.region,
      ...args,
    ])

  async function getStackResources() {
    stackResources ??= awsJson<{
      StackResourceSummaries: StackResource[]
    }>([
      'cloudformation',
      'list-stack-resources',
      '--stack-name',
      STACK_NAME,
    ]).StackResourceSummaries
    return stackResources
  }

  async function getBucketName() {
    if (bucketName) return bucketName
    const outputs = awsJson<{
      Stacks: Array<{
        Outputs?: Array<{ OutputKey: string; OutputValue: string }>
      }>
    }>([
      'cloudformation',
      'describe-stacks',
      '--stack-name',
      STACK_NAME,
    ]).Stacks[0]?.Outputs
    bucketName =
      outputs?.find(
        (output) => output.OutputKey === 'PropertySourceBucketName',
      )?.OutputValue ?? null
    if (!bucketName) throw new Error('SYNTHETIC_BUCKET_NOT_FOUND')
    return bucketName
  }

  return {
    now: () => new Date(),
    createRunId: (now) => createRunId(now),
    createPassword: () =>
      `Aa1!${randomBytes(32).toString('base64url')}`,
    aws: {
      getConfiguredRegion: async (profile) =>
        runAwsText([
          'configure',
          'get',
          'region',
          '--profile',
          profile,
        ]).trim(),
      getCallerIdentity: async () =>
        awsJson<{ Account: string; Arn: string }>([
          'sts',
          'get-caller-identity',
        ]),
      checkDlq: async () => {
        const resources = await getStackResources()
        const queue = resources.find(
          (resource) =>
            resource.ResourceType === 'AWS::SQS::Queue' &&
            resource.LogicalResourceId.includes('DeadLetterQueue'),
        )
        if (!queue) throw new Error('SYNTHETIC_DLQ_NOT_FOUND')
        const attributes = awsJson<{
          Attributes?: { ApproximateNumberOfMessages?: string }
        }>([
          'sqs',
          'get-queue-attributes',
          '--queue-url',
          queue.PhysicalResourceId,
          '--attribute-names',
          'ApproximateNumberOfMessages',
        ])
        return Number(
          attributes.Attributes?.ApproximateNumberOfMessages ?? 0,
        )
      },
      checkAlarms: async () => {
        const resources = await getStackResources()
        const alarmNames = resources
          .filter(
            (resource) =>
              resource.ResourceType === 'AWS::CloudWatch::Alarm',
          )
          .map((resource) => resource.PhysicalResourceId)
        if (alarmNames.length === 0) {
          throw new Error('SYNTHETIC_ALARMS_NOT_FOUND')
        }
        const alarms = awsJson<{ MetricAlarms?: unknown[] }>([
          'cloudwatch',
          'describe-alarms',
          '--state-value',
          'ALARM',
          '--alarm-names',
          ...alarmNames,
        ])
        return alarms.MetricAlarms?.length ?? 0
      },
      createCognitoUser: async (username, password) => {
        const { userPoolId } = readCognitoIdentifiers()
        const created = awsJson<{
          User?: {
            Attributes?: Array<{ Name: string; Value: string }>
          }
        }>([
          'cognito-idp',
          'admin-create-user',
          '--user-pool-id',
          userPoolId,
          '--username',
          username,
          '--temporary-password',
          password,
          '--message-action',
          'SUPPRESS',
          '--user-attributes',
          `Name=email,Value=${username}`,
          'Name=email_verified,Value=true',
        ])
        awsText([
          'cognito-idp',
          'admin-set-user-password',
          '--user-pool-id',
          userPoolId,
          '--username',
          username,
          '--password',
          password,
          '--permanent',
        ])
        const cognitoSub = created.User?.Attributes?.find(
          (attribute) => attribute.Name === 'sub',
        )?.Value
        if (!cognitoSub) throw new Error('SYNTHETIC_COGNITO_SUB_MISSING')
        return { cognitoSub }
      },
      authenticateCognitoUser: async (username, password) => {
        const { clientId } = readCognitoIdentifiers()
        const result = awsJson<{
          AuthenticationResult?: { AccessToken?: string }
        }>([
          'cognito-idp',
          'initiate-auth',
          '--auth-flow',
          'USER_PASSWORD_AUTH',
          '--client-id',
          clientId,
          '--auth-parameters',
          `USERNAME=${username},PASSWORD=${password}`,
        ])
        const accessToken = result.AuthenticationResult?.AccessToken
        if (!accessToken) {
          throw new Error('SYNTHETIC_COGNITO_AUTH_FAILED')
        }
        return { accessToken }
      },
      deleteCognitoUser: async (username) => {
        const { userPoolId } = readCognitoIdentifiers()
        const outcome = tryAws([
          '--profile',
          options.profile,
          '--region',
          options.region,
          'cognito-idp',
          'admin-delete-user',
          '--user-pool-id',
          userPoolId,
          '--username',
          username,
        ])
        if (
          !outcome.ok &&
          !outcome.errorText.includes('UserNotFoundException')
        ) {
          throw new Error('SYNTHETIC_COGNITO_DELETE_FAILED')
        }
      },
      verifyS3Empty: async (organizationPrefix) => {
        const bucket = await getBucketName()
        return listObjectVersions(
          awsJson,
          bucket,
          organizationPrefix,
        ).length
      },
      purgeRegisteredObjects: async (registry) => {
        const bucket = await getBucketName()
        const allowedKeys = new Set(registry.storageKeys)
        for (const storageKey of allowedKeys) {
          const versions = listObjectVersions(
            awsJson,
            bucket,
            storageKey,
          ).filter((version) => version.Key === storageKey)
          for (const version of versions) {
            awsJson([
              's3api',
              'delete-object',
              '--bucket',
              bucket,
              '--key',
              version.Key,
              '--version-id',
              version.VersionId,
            ])
          }
        }
      },
    },
    http: {
      createSession: async (accessToken) => {
        const response = await fetch(
          `${PRODUCTION_SYNTHETIC_BASE_URL}/api/auth/session`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ accessToken }),
          },
        )
        if (!response.ok) throw new Error('SYNTHETIC_SESSION_FAILED')
        const setCookie = response.headers.get('set-cookie')
        const cookie = setCookie?.split(';', 1)[0]
        if (!cookie) throw new Error('SYNTHETIC_SESSION_COOKIE_MISSING')
        return {
          cookie,
          userId: readJwtSubject(accessToken),
        }
      },
      executeCorpus: async (context) =>
        executeCorpusHttp(context, options.baseUrl),
      deleteAccount: async (cookie) => {
        await fetchJson(`${options.baseUrl}/api/account/delete`, {
          method: 'POST',
          cookie,
          body: { confirm: 'DELETE' },
        })
      },
      verifyAccountAbsent: async (cookie) => {
        const result = await fetchJson<{ projects?: unknown[] }>(
          `${options.baseUrl}/api/properties`,
          { cookie },
        )
        return Array.isArray(result.projects) && result.projects.length === 0
      },
    },
    registry: {
      save: async (registry) => {
        await saveSyntheticCleanupRegistry(
          options.workspaceRoot,
          registry,
        )
      },
      remove: async (runId) => {
        await removeSyntheticCleanupRegistry(
          options.workspaceRoot,
          runId,
        )
      },
    },
    writeReport: (report) =>
      writeProductionReport(options.workspaceRoot, report),
  }
}

async function executeCorpusHttp(
  {
    registry,
    saveRegistry,
    cookie,
  }: {
    registry: SyntheticCleanupRegistry
    saveRegistry: () => Promise<void>
    cookie: string
    maxCostUsd: number
  },
  baseUrl: string,
): Promise<{
  observations: SyntheticObservation[]
  jobs: SyntheticJobObservation[]
  modelIds: string[]
}> {
  const generated = await generateSyntheticCorpus(syntheticCorpus)
  const generatedByMaterial = new Map(
    generated.map((material) => [material.materialId, material]),
  )
  const sourceContext = new Map<
    string,
    { caseCode: SyntheticObservation['caseCode']; materialId: string }
  >()

  for (const item of syntheticCorpus.cases) {
    const project = (
      await fetchJson<{ project: PropertyProject }>(
        `${baseUrl}/api/properties`,
        {
          method: 'POST',
          cookie,
          body: {
            title: `${item.code} · ${item.title}`,
            propertyType: item.propertyType,
            transactionType: item.transactionType,
            city: item.city,
            district: item.district,
            addressMode: item.addressMode,
          },
        },
      )
    ).project
    registry.projectIds.push(project.id)
    if (!registry.organizationId) {
      registry.organizationId = project.organizationId
      registry.organizationPrefix =
        `originals/organizations/${project.organizationId}/`
    }
    if (registry.organizationId !== project.organizationId) {
      throw new Error('SYNTHETIC_ORGANIZATION_MISMATCH')
    }
    await saveRegistry()

    for (const seedFact of item.seedFacts) {
      const definition = resolveFactDefinition(
        seedFact.factKey,
        item.propertyType,
      )
      if (!definition) throw new Error('SYNTHETIC_FACT_DEFINITION_MISSING')
      await fetchJson(
        `${baseUrl}/api/properties/${project.id}/facts`,
        {
          method: 'POST',
          cookie,
          body: {
            key: seedFact.factKey,
            label: definition.label,
            category: definition.category,
            valueType: seedFact.valueType,
            value: seedFact.value,
            unit: seedFact.unit,
            status: 'confirmed',
            visibility: 'client',
            sourceIds: [],
          },
        },
      )
    }

    for (const material of item.materials) {
      const currentCost = await readCurrentProviderCost(baseUrl, cookie)
      if (currentCost >= COST_STOP_BEFORE_USD) {
        throw new Error('SYNTHETIC_COST_STOP')
      }
      const generatedMaterial = generatedByMaterial.get(material.id)
      if (!generatedMaterial) {
        throw new Error('SYNTHETIC_GENERATED_MATERIAL_MISSING')
      }
      const registered = await fetchJson<{
        source: PropertySource
        upload: {
          method: 'POST'
          url: string
          fields: Record<string, string>
        }
      }>(`${baseUrl}/api/properties/${project.id}/sources`, {
        method: 'POST',
        cookie,
        body: {
          fileName: generatedMaterial.fileName,
          mediaType: generatedMaterial.mediaType,
          sizeBytes: generatedMaterial.bytes.byteLength,
          checksumSha256: generatedMaterial.checksumSha256,
        },
      })
      registry.sourceIds.push(registered.source.id)
      registry.storageKeys.push(registered.source.storageKey)
      sourceContext.set(registered.source.id, {
        caseCode: item.code,
        materialId: material.id,
      })
      await saveRegistry()
      await uploadPresigned(
        registered.upload,
        generatedMaterial.bytes,
        generatedMaterial.fileName,
        generatedMaterial.mediaType,
      )
      const terminalSource = await waitForTerminalSource(
        baseUrl,
        cookie,
        project.id,
        registered.source.id,
      )
      if (
        material.expectedOutcome === 'controlled_failure' &&
        terminalSource.status !== 'failed'
      ) {
        throw new Error('SYNTHETIC_CONTROLLED_FAILURE_MISSING')
      }
      if (
        material.expectedOutcome === 'review_ready' &&
        !['review_ready', 'completed'].includes(terminalSource.status)
      ) {
        throw new Error('SYNTHETIC_SOURCE_NOT_REVIEW_READY')
      }
    }
  }

  await fetchJson(`${baseUrl}/api/properties`, { cookie })
  const exported = await fetchJson<AccountExport>(
    `${baseUrl}/api/account/export`,
    { cookie },
  )
  const observations = exported.propertyStudio.factProposals.flatMap(
    (proposal): SyntheticObservation[] => {
      const context = sourceContext.get(proposal.sourceId)
      if (!context) return []
      return [
        {
          caseCode: context.caseCode,
          materialId: context.materialId,
          factKey: proposal.factKey,
          value: proposal.value,
          evidenceLocator: proposal.evidenceLocator,
          sourceId: proposal.sourceId,
          proposalStatus: proposal.status,
        },
      ]
    },
  )
  const jobs = exported.propertyStudio.sourceJobs.map(
    (job): SyntheticJobObservation => ({
      sourceId: job.sourceId,
      idempotencyKey: job.idempotencyKey,
      durationMs: job.durationMs ?? 0,
      providerCostUsd: (job.providerCostMicrounits ?? 0) / 1_000_000,
      errorCode: job.errorCode,
    }),
  )
  const modelIds = [
    ...new Set(
      exported.propertyStudio.sourceJobs
        .map((job) => job.modelId)
        .filter((modelId): modelId is string => Boolean(modelId)),
    ),
  ]
  return { observations, jobs, modelIds }
}

async function waitForTerminalSource(
  baseUrl: string,
  cookie: string,
  projectId: string,
  sourceId: string,
) {
  const deadline = Date.now() + SOURCE_POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    const response = await fetchJson<{ sources: PropertySource[] }>(
      `${baseUrl}/api/properties/${projectId}/sources`,
      { cookie },
    )
    const source = response.sources.find(
      (candidate) => candidate.id === sourceId,
    )
    if (source && TERMINAL_SOURCE_STATUSES.has(source.status)) {
      return source
    }
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, SOURCE_POLL_INTERVAL_MS),
    )
  }
  throw new Error('SYNTHETIC_SOURCE_POLL_TIMEOUT')
}

async function readCurrentProviderCost(
  baseUrl: string,
  cookie: string,
) {
  const exported = await fetchJson<AccountExport>(
    `${baseUrl}/api/account/export`,
    { cookie },
  )
  return exported.propertyStudio.sourceJobs.reduce(
    (total, job) =>
      total + (job.providerCostMicrounits ?? 0) / 1_000_000,
    0,
  )
}

async function uploadPresigned(
  upload: {
    method: 'POST'
    url: string
    fields: Record<string, string>
  },
  bytes: Uint8Array,
  fileName: string,
  mediaType: string,
) {
  if (upload.method !== 'POST') {
    throw new Error('SYNTHETIC_UPLOAD_METHOD_INVALID')
  }
  const form = new FormData()
  for (const [key, value] of Object.entries(upload.fields)) {
    form.append(key, value)
  }
  form.append(
    'file',
    new Blob([Buffer.from(bytes)], { type: mediaType }),
    fileName,
  )
  const response = await fetch(upload.url, {
    method: 'POST',
    body: form,
  })
  if (!response.ok) throw new Error('SYNTHETIC_UPLOAD_FAILED')
}

async function fetchJson<T = unknown>(
  url: string,
  options: {
    method?: string
    cookie?: string
    body?: unknown
  },
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })
  if (!response.ok) {
    throw new Error(`SYNTHETIC_HTTP_${response.status}`)
  }
  return (await response.json()) as T
}

function readCognitoIdentifiers() {
  const userPoolId =
    (
      process.env.COGNITO_USER_POOL_ID ??
      process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID
    )?.trim()
  const clientId =
    (
      process.env.COGNITO_CLIENT_ID ??
      process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
    )?.trim()
  if (!userPoolId || !clientId) {
    throw new Error('SYNTHETIC_COGNITO_CONFIG_MISSING')
  }
  return { userPoolId, clientId }
}

function readJwtSubject(token: string) {
  const payload = token.split('.')[1]
  if (!payload) throw new Error('SYNTHETIC_ACCESS_TOKEN_INVALID')
  const parsed = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as { sub?: unknown }
  if (typeof parsed.sub !== 'string') {
    throw new Error('SYNTHETIC_ACCESS_TOKEN_INVALID')
  }
  return parsed.sub
}

function listObjectVersions(
  awsJson: <T>(args: string[]) => T,
  bucket: string,
  prefix: string,
) {
  const result = awsJson<{
    Versions?: Array<{ Key?: string; VersionId?: string }>
    DeleteMarkers?: Array<{ Key?: string; VersionId?: string }>
  }>([
    's3api',
    'list-object-versions',
    '--bucket',
    bucket,
    '--prefix',
    prefix,
  ])
  return [...(result.Versions ?? []), ...(result.DeleteMarkers ?? [])]
    .filter(
      (
        item,
      ): item is {
        Key: string
        VersionId: string
      } => Boolean(item.Key && item.VersionId),
    )
}

function runAwsJson<T>(
  profile: string,
  region: string,
  args: string[],
): T {
  return JSON.parse(
    runAwsText([
      '--profile',
      profile,
      '--region',
      region,
      ...args,
      '--output',
      'json',
    ]),
  ) as T
}

function runAwsText(args: string[]) {
  const outcome = tryAws(args)
  if (!outcome.ok) {
    const operation = args.find((argument) => !argument.startsWith('-'))
    throw new Error(
      `SYNTHETIC_AWS_COMMAND_FAILED:${operation ?? 'unknown'}`,
    )
  }
  return outcome.output
}

function tryAws(args: string[]) {
  try {
    return {
      ok: true as const,
      output: execFileSync('aws', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 10 * 1024 * 1024,
      }),
      errorText: '',
    }
  } catch (error) {
    const errorText =
      error &&
      typeof error === 'object' &&
      'stderr' in error &&
      (typeof error.stderr === 'string' || Buffer.isBuffer(error.stderr))
        ? String(error.stderr)
        : ''
    return { ok: false as const, output: '', errorText }
  }
}

function createRunId(now: Date) {
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
  return runIdSchema.parse(
    `syn-${timestamp}-${randomBytes(4).toString('hex')}`,
  )
}

async function writeProductionReport(
  workspaceRoot: string,
  report: SafeSyntheticAcceptanceReport,
) {
  const directory = resolve(
    workspaceRoot,
    'reports',
    'synthetic-acceptance',
  )
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await writeFile(
    join(directory, `${report.runId}.json`),
    serializeSafeReport(report),
    { mode: 0o600 },
  )
}
