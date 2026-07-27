import type { S3Client } from '@aws-sdk/client-s3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropertySource } from './domain'
import {
  AwsPropertySourceObjectStore,
  type AwsObjectStoreDependencies,
} from './aws-object-store'
import type { AwsPropertySourceConfig } from './aws-config'

const config: AwsPropertySourceConfig = {
  region: 'eu-central-1',
  bucket: 'property-studio-dev-111122223333',
  kmsKeyArn:
    'arn:aws:kms:eu-central-1:111122223333:key/12345678-1234-4234-8234-123456789012',
  signerRoleArn:
    'arn:aws:iam::111122223333:role/property-source-signer',
}

const source: PropertySource = {
  id: '33333333-3333-4333-8333-333333333333',
  organizationId: '11111111-1111-4111-8111-111111111111',
  propertyProjectId: '22222222-2222-4222-8222-222222222222',
  storageKey:
    'originals/organizations/11111111-1111-4111-8111-111111111111/properties/22222222-2222-4222-8222-222222222222/sources/33333333-3333-4333-8333-333333333333/original',
  fileName: 'operat szacunkowy.pdf',
  mediaType: 'application/pdf',
  sizeBytes: 12_345,
  checksumSha256: 'ab'.repeat(32),
  status: 'upload_pending',
  errorCode: null,
  errorMessage: null,
  uploadedAt: null,
  processedAt: null,
  createdByUserId: 'user-1',
  createdAt: new Date('2026-07-27T12:00:00.000Z'),
  updatedAt: new Date('2026-07-27T12:00:00.000Z'),
}

const now = new Date('2026-07-27T12:00:00.000Z')

function createHarness(scanStatus = 'NO_THREATS_FOUND') {
  const credentials = vi.fn() as unknown as ReturnType<
    AwsObjectStoreDependencies['createCredentialsProvider']
  >
  const createCredentialsProvider = vi.fn<
    AwsObjectStoreDependencies['createCredentialsProvider']
  >(() => credentials)
  const send = vi.fn<
    (command: { input: Record<string, unknown> }) => Promise<{
      TagSet: Array<{ Key: string; Value: string }>
    }>
  >(async () => ({
      TagSet: [
        {
          Key: 'GuardDutyMalwareScanStatus',
          Value: scanStatus,
        },
      ],
    }))
  const client = { send } as unknown as S3Client
  const createS3Client = vi.fn<
    AwsObjectStoreDependencies['createS3Client']
  >(() => client)
  const createPresignedPost = vi.fn<
    AwsObjectStoreDependencies['createPresignedPost']
  >(async () => ({
      url: 'https://upload.example.test',
      fields: { policy: 'signed-policy' },
    }))
  const getSignedUrl = vi.fn<
    AwsObjectStoreDependencies['getSignedUrl']
  >(async () => 'https://download.example.test')
  const dependencies: AwsObjectStoreDependencies = {
    createCredentialsProvider,
    createS3Client,
    createPresignedPost,
    getSignedUrl,
    now: () => now,
  }

  return {
    store: new AwsPropertySourceObjectStore(config, dependencies),
    credentials,
    createCredentialsProvider,
    createS3Client,
    createPresignedPost,
    getSignedUrl,
    send,
  }
}

describe('AwsPropertySourceObjectStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signs a five-minute POST constrained to one exact source', async () => {
    const harness = createHarness()

    await expect(harness.store.createUploadGrant(source)).resolves.toEqual({
      method: 'POST',
      url: 'https://upload.example.test',
      fields: { policy: 'signed-policy' },
      expiresAt: '2026-07-27T12:05:00.000Z',
    })

    const credentialsInput =
      harness.createCredentialsProvider.mock.calls[0][0]
    expect(credentialsInput).toMatchObject({
      audience: 'sts.amazonaws.com',
      clientConfig: { region: 'eu-central-1' },
      durationSeconds: 900,
      roleArn: config.signerRoleArn,
      roleSessionName:
        'source-upload-33333333333343338333333333333333',
    })
    expect(credentialsInput.policy).toBeTypeOf('string')
    expect(JSON.parse(credentialsInput.policy!)).toEqual({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: 's3:PutObject',
          Resource:
            `arn:aws:s3:::${config.bucket}/${source.storageKey}`,
        },
        {
          Effect: 'Allow',
          Action: ['kms:GenerateDataKey', 'kms:Encrypt'],
          Resource: config.kmsKeyArn,
          Condition: {
            StringEquals: {
              'kms:ViaService': 's3.eu-central-1.amazonaws.com',
            },
          },
        },
      ],
    })
    expect(JSON.stringify(credentialsInput.policy)).not.toContain(
      's3:ListBucket',
    )
    expect(harness.createS3Client.mock.calls[0][0].credentials).toBe(
      harness.credentials,
    )
    expect(harness.credentials).not.toHaveBeenCalled()

    const postInput = harness.createPresignedPost.mock.calls[0][1]
    const checksumBase64 = Buffer.from(
      source.checksumSha256,
      'hex',
    ).toString('base64')
    expect(postInput).toEqual({
      Bucket: config.bucket,
      Key: source.storageKey,
      Expires: 300,
      Fields: {
        'Content-Type': source.mediaType,
        'x-amz-checksum-sha256': checksumBase64,
        'x-amz-meta-source-id': source.id,
        'x-amz-server-side-encryption': 'aws:kms',
        'x-amz-server-side-encryption-aws-kms-key-id': config.kmsKeyArn,
      },
      Conditions: [
        ['eq', '$key', source.storageKey],
        ['eq', '$Content-Type', source.mediaType],
        ['content-length-range', source.sizeBytes, source.sizeBytes],
        ['eq', '$x-amz-checksum-sha256', checksumBase64],
        ['eq', '$x-amz-meta-source-id', source.id],
        ['eq', '$x-amz-server-side-encryption', 'aws:kms'],
        [
          'eq',
          '$x-amz-server-side-encryption-aws-kms-key-id',
          config.kmsKeyArn,
        ],
      ],
    })
  })

  it('refuses a download unless GuardDuty marked the object clean', async () => {
    const harness = createHarness('THREATS_FOUND')

    await expect(
      harness.store.createCleanDownloadUrl(source),
    ).rejects.toThrow('SOURCE_NOT_CLEAN')
    expect(harness.getSignedUrl).not.toHaveBeenCalled()
  })

  it('signs a clean download for only sixty seconds', async () => {
    const harness = createHarness()

    await expect(
      harness.store.createCleanDownloadUrl(source),
    ).resolves.toEqual({
      url: 'https://download.example.test',
      expiresAt: '2026-07-27T12:01:00.000Z',
    })

    const credentialsInput =
      harness.createCredentialsProvider.mock.calls[0][0]
    expect(credentialsInput.policy).toBeTypeOf('string')
    expect(JSON.parse(credentialsInput.policy!)).toEqual({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:GetObject', 's3:GetObjectTagging'],
          Resource:
            `arn:aws:s3:::${config.bucket}/${source.storageKey}`,
        },
        {
          Effect: 'Allow',
          Action: 'kms:Decrypt',
          Resource: config.kmsKeyArn,
          Condition: {
            StringEquals: {
              'kms:ViaService': 's3.eu-central-1.amazonaws.com',
            },
          },
        },
      ],
    })
    expect(JSON.stringify(credentialsInput.policy)).not.toContain(
      's3:ListBucket',
    )

    const tagCommand = harness.send.mock.calls[0][0]
    expect(tagCommand.input).toEqual({
      Bucket: config.bucket,
      Key: source.storageKey,
    })
    const [, downloadCommand, options] =
      harness.getSignedUrl.mock.calls[0]
    expect(downloadCommand.input).toMatchObject({
      Bucket: config.bucket,
      Key: source.storageKey,
    })
    expect(downloadCommand.input.ResponseContentDisposition).not.toMatch(
      /[\r\n]/,
    )
    expect(options).toEqual({ expiresIn: 60 })
  })

  it('signs a clean inline preview without weakening scan checks', async () => {
    const harness = createHarness()

    await expect(
      harness.store.createCleanDownloadUrl(source, 'inline'),
    ).resolves.toEqual({
      url: 'https://download.example.test',
      expiresAt: '2026-07-27T12:01:00.000Z',
    })

    const [, previewCommand] = harness.getSignedUrl.mock.calls[0]
    expect(previewCommand.input.ResponseContentDisposition).toMatch(
      /^inline;/,
    )
    expect(previewCommand.input.ResponseContentDisposition).not.toMatch(
      /[\r\n]/,
    )
  })

  it('does not leak AWS identifiers when signing fails', async () => {
    const harness = createHarness()
    harness.createPresignedPost.mockRejectedValueOnce(
      new Error(
        `access-key-secret ${config.bucket} ${config.kmsKeyArn} ${config.signerRoleArn}`,
      ),
    )

    const result = harness.store.createUploadGrant(source)
    await expect(result).rejects.toThrow('SOURCE_UPLOAD_SIGNING_FAILED')
    await expect(result).rejects.not.toThrow(config.bucket)
    await expect(result).rejects.not.toThrow(config.kmsKeyArn)
    await expect(result).rejects.not.toThrow(config.signerRoleArn)
    await expect(result).rejects.not.toThrow('access-key-secret')
  })

  it('does not leak AWS identifiers when scan lookup fails', async () => {
    const harness = createHarness()
    harness.send.mockRejectedValueOnce(
      new Error(
        `credential-value ${config.bucket} ${config.kmsKeyArn} ${config.signerRoleArn}`,
      ),
    )

    const result = harness.store.createCleanDownloadUrl(source)
    await expect(result).rejects.toThrow(
      'SOURCE_DOWNLOAD_SIGNING_FAILED',
    )
    await expect(result).rejects.not.toThrow(config.bucket)
    await expect(result).rejects.not.toThrow(config.kmsKeyArn)
    await expect(result).rejects.not.toThrow(config.signerRoleArn)
    await expect(result).rejects.not.toThrow('credential-value')
  })
})
