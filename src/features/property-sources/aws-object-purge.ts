import {
  DeleteObjectsCommand,
  ListObjectVersionsCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3'
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider'
import type { PropertySource } from './domain'
import { assertExpectedPropertySourceStorageKey } from './object-store'
import type { PropertySourceObjectPurger } from './object-purge'

type CredentialsProviderInput = Parameters<
  typeof awsCredentialsProvider
>[0]
type CredentialsProvider = ReturnType<typeof awsCredentialsProvider>

export type AwsPropertySourcePurgeConfig = {
  region: 'eu-central-1'
  bucket: string
  deletionRoleArn: string
}

export type AwsObjectPurgeDependencies = {
  createCredentialsProvider: (
    input: CredentialsProviderInput,
  ) => CredentialsProvider
  createS3Client: (config: S3ClientConfig) => S3Client
}

const defaultDependencies: AwsObjectPurgeDependencies = {
  createCredentialsProvider: awsCredentialsProvider,
  createS3Client: (config) => new S3Client(config),
}

type ObjectVersionIdentity = {
  Key: string
  VersionId: string
}

export class AwsPropertySourceObjectPurger
  implements PropertySourceObjectPurger
{
  constructor(
    private readonly config: AwsPropertySourcePurgeConfig,
    private readonly dependencies: AwsObjectPurgeDependencies =
      defaultDependencies,
  ) {}

  async purgeSources(sources: PropertySource[]) {
    if (sources.length === 0) {
      throw new Error('SOURCE_OBJECT_PURGE_EMPTY')
    }
    for (const source of sources) {
      assertExpectedPropertySourceStorageKey(source)
    }

    const organizationIds = new Set(
      sources.map((source) => source.organizationId),
    )
    if (organizationIds.size !== 1) {
      throw new Error('SOURCE_OBJECT_PURGE_MIXED_ORGANIZATIONS')
    }

    const organizationId = sources[0].organizationId
    const organizationPrefix =
      `originals/organizations/${organizationId}/`
    const allowedKeys = new Set(
      sources.map((source) => source.storageKey),
    )
    const credentials = this.dependencies.createCredentialsProvider({
      audience: 'sts.amazonaws.com',
      roleArn: this.config.deletionRoleArn,
      roleSessionName:
        `source-delete-${organizationId.replace(/-/g, '').slice(0, 32)}`,
      clientConfig: { region: this.config.region },
      durationSeconds: 900,
      policy: createPurgeSessionPolicy(
        this.config.bucket,
        organizationPrefix,
        [...allowedKeys],
      ),
    })
    const client = this.dependencies.createS3Client({
      region: this.config.region,
      credentials,
    })

    const versions = await this.listExactVersions(
      client,
      organizationPrefix,
      allowedKeys,
    )
    for (let offset = 0; offset < versions.length; offset += 1000) {
      const batch = versions.slice(offset, offset + 1000)
      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: this.config.bucket,
          Delete: { Objects: batch, Quiet: true },
        }),
      )
      if ((result.Errors?.length ?? 0) > 0) {
        throw new Error('SOURCE_OBJECT_PURGE_FAILED')
      }
    }

    const remaining = await this.listExactVersions(
      client,
      organizationPrefix,
      allowedKeys,
    )
    if (remaining.length > 0) {
      throw new Error('SOURCE_OBJECT_PURGE_INCOMPLETE')
    }

    return { deletedVersions: versions.length }
  }

  private async listExactVersions(
    client: S3Client,
    prefix: string,
    allowedKeys: Set<string>,
  ): Promise<ObjectVersionIdentity[]> {
    const found: ObjectVersionIdentity[] = []
    let keyMarker: string | undefined
    let versionIdMarker: string | undefined

    for (;;) {
      const result = await client.send(
        new ListObjectVersionsCommand({
          Bucket: this.config.bucket,
          Prefix: prefix,
          KeyMarker: keyMarker,
          VersionIdMarker: versionIdMarker,
        }),
      )
      for (const candidate of [
        ...(result.Versions ?? []),
        ...(result.DeleteMarkers ?? []),
      ]) {
        if (
          candidate.Key &&
          candidate.VersionId &&
          allowedKeys.has(candidate.Key)
        ) {
          found.push({
            Key: candidate.Key,
            VersionId: candidate.VersionId,
          })
        }
      }

      if (!result.IsTruncated) break
      if (!result.NextKeyMarker) {
        throw new Error('SOURCE_OBJECT_PURGE_PAGINATION_INVALID')
      }
      keyMarker = result.NextKeyMarker
      versionIdMarker = result.NextVersionIdMarker
    }

    return found
  }
}

function createPurgeSessionPolicy(
  bucket: string,
  organizationPrefix: string,
  storageKeys: string[],
) {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['s3:DeleteObject', 's3:DeleteObjectVersion'],
        Resource:
          storageKeys.length === 1
            ? `arn:aws:s3:::${bucket}/${storageKeys[0]}`
            : storageKeys.map(
                (storageKey) =>
                  `arn:aws:s3:::${bucket}/${storageKey}`,
              ),
      },
      {
        Effect: 'Allow',
        Action: 's3:ListBucketVersions',
        Resource: `arn:aws:s3:::${bucket}`,
        Condition: {
          StringEquals: {
            's3:prefix': [organizationPrefix, ...storageKeys],
          },
        },
      },
    ],
  })
}
