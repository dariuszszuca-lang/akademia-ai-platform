import {
  GetObjectCommand,
  GetObjectTaggingCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3'
import {
  createPresignedPost,
  type PresignedPost,
  type PresignedPostOptions,
} from '@aws-sdk/s3-presigned-post'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider'
import type { PropertySource } from './domain'
import type { AwsPropertySourceConfig } from './aws-config'
import {
  assertExpectedPropertySourceStorageKey,
  createAttachmentContentDisposition,
  type PropertySourceObjectStore,
  type SourceUploadGrant,
} from './object-store'

type CredentialsProviderInput = Parameters<
  typeof awsCredentialsProvider
>[0]
type CredentialsProvider = ReturnType<typeof awsCredentialsProvider>

export type AwsObjectStoreDependencies = {
  createCredentialsProvider: (
    input: CredentialsProviderInput,
  ) => CredentialsProvider
  createS3Client: (config: S3ClientConfig) => S3Client
  createPresignedPost: (
    client: S3Client,
    options: PresignedPostOptions,
  ) => Promise<PresignedPost>
  getSignedUrl: (
    client: S3Client,
    command: GetObjectCommand,
    options: { expiresIn: number },
  ) => Promise<string>
  now: () => Date
}

const defaultDependencies: AwsObjectStoreDependencies = {
  createCredentialsProvider: awsCredentialsProvider,
  createS3Client: (config) => new S3Client(config),
  createPresignedPost,
  getSignedUrl,
  now: () => new Date(),
}

export class AwsPropertySourceObjectStore
  implements PropertySourceObjectStore
{
  constructor(
    private readonly config: AwsPropertySourceConfig,
    private readonly dependencies: AwsObjectStoreDependencies =
      defaultDependencies,
  ) {}

  async createUploadGrant(
    source: PropertySource,
  ): Promise<SourceUploadGrant> {
    try {
      assertExpectedPropertySourceStorageKey(source)
      const client = this.createClient(
        source,
        'upload',
        createUploadSessionPolicy(this.config, source.storageKey),
      )
      const checksumBase64 = Buffer.from(
        source.checksumSha256,
        'hex',
      ).toString('base64')
      const fields = {
        'Content-Type': source.mediaType,
        'x-amz-checksum-sha256': checksumBase64,
        'x-amz-meta-source-id': source.id,
        'x-amz-server-side-encryption': 'aws:kms',
        'x-amz-server-side-encryption-aws-kms-key-id':
          this.config.kmsKeyArn,
      }
      const conditions: NonNullable<PresignedPostOptions['Conditions']> = [
        ['eq', '$key', source.storageKey],
        ['eq', '$Content-Type', source.mediaType],
        ['content-length-range', source.sizeBytes, source.sizeBytes],
        ['eq', '$x-amz-checksum-sha256', checksumBase64],
        ['eq', '$x-amz-meta-source-id', source.id],
        ['eq', '$x-amz-server-side-encryption', 'aws:kms'],
        [
          'eq',
          '$x-amz-server-side-encryption-aws-kms-key-id',
          this.config.kmsKeyArn,
        ],
      ]
      const upload = await this.dependencies.createPresignedPost(client, {
        Bucket: this.config.bucket,
        Key: source.storageKey,
        Expires: 300,
        Fields: fields,
        Conditions: conditions,
      })

      return {
        method: 'POST',
        url: upload.url,
        fields: upload.fields,
        expiresAt: addSeconds(this.dependencies.now(), 300),
      }
    } catch {
      throw new Error('SOURCE_UPLOAD_SIGNING_FAILED')
    }
  }

  async createCleanDownloadUrl(source: PropertySource) {
    try {
      assertExpectedPropertySourceStorageKey(source)
      const client = this.createClient(
        source,
        'download',
        createDownloadSessionPolicy(this.config, source.storageKey),
      )
      const tagResult = await client.send(
        new GetObjectTaggingCommand({
          Bucket: this.config.bucket,
          Key: source.storageKey,
        }),
      )
      const scanStatus = tagResult.TagSet?.find(
        (tag) => tag.Key === 'GuardDutyMalwareScanStatus',
      )?.Value

      if (scanStatus !== 'NO_THREATS_FOUND') {
        throw new SourceNotCleanError()
      }

      const url = await this.dependencies.getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: source.storageKey,
          ResponseContentDisposition:
            createAttachmentContentDisposition(source.fileName),
        }),
        { expiresIn: 60 },
      )

      return {
        url,
        expiresAt: addSeconds(this.dependencies.now(), 60),
      }
    } catch (error) {
      if (error instanceof SourceNotCleanError) {
        throw new Error('SOURCE_NOT_CLEAN')
      }
      throw new Error('SOURCE_DOWNLOAD_SIGNING_FAILED')
    }
  }

  private createClient(
    source: PropertySource,
    purpose: 'upload' | 'download',
    policy: string,
  ): S3Client {
    const sourceToken = source.id.replace(/-/g, '').slice(0, 32)
    const credentials = this.dependencies.createCredentialsProvider({
      audience: 'sts.amazonaws.com',
      roleArn: this.config.signerRoleArn,
      roleSessionName: `source-${purpose}-${sourceToken}`,
      clientConfig: { region: this.config.region },
      durationSeconds: 900,
      policy,
    })

    return this.dependencies.createS3Client({
      region: this.config.region,
      credentials,
    })
  }
}

class SourceNotCleanError extends Error {}

function createUploadSessionPolicy(
  config: AwsPropertySourceConfig,
  storageKey: string,
): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: 's3:PutObject',
        Resource: createObjectArn(config.bucket, storageKey),
      },
      {
        Effect: 'Allow',
        Action: ['kms:GenerateDataKey', 'kms:Encrypt'],
        Resource: config.kmsKeyArn,
        Condition: {
          StringEquals: {
            'kms:ViaService': `s3.${config.region}.amazonaws.com`,
          },
        },
      },
    ],
  })
}

function createDownloadSessionPolicy(
  config: AwsPropertySourceConfig,
  storageKey: string,
): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['s3:GetObject', 's3:GetObjectTagging'],
        Resource: createObjectArn(config.bucket, storageKey),
      },
      {
        Effect: 'Allow',
        Action: 'kms:Decrypt',
        Resource: config.kmsKeyArn,
        Condition: {
          StringEquals: {
            'kms:ViaService': `s3.${config.region}.amazonaws.com`,
          },
        },
      },
    ],
  })
}

function createObjectArn(bucket: string, storageKey: string): string {
  return `arn:aws:s3:::${bucket}/${storageKey}`
}

function addSeconds(date: Date, seconds: number): string {
  return new Date(date.getTime() + seconds * 1000).toISOString()
}
