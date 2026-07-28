import type { S3Client } from '@aws-sdk/client-s3'
import { describe, expect, it, vi } from 'vitest'
import type { PropertySource } from './domain'
import {
  AwsPropertySourceObjectPurger,
  type AwsObjectPurgeDependencies,
} from './aws-object-purge'

const organizationId = '11111111-1111-4111-8111-111111111111'
const source = createSource()
const config = {
  region: 'eu-central-1' as const,
  bucket: 'property-studio-prod-261965598943',
  deletionRoleArn:
    'arn:aws:iam::261965598943:role/property-source-deletion',
}

describe('AwsPropertySourceObjectPurger', () => {
  it('deletes every version and delete marker for exact source keys', async () => {
    const send = vi.fn(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === 'ListObjectVersionsCommand') {
        const listCallCount = send.mock.calls.filter(
          ([candidate]) =>
            candidate.constructor.name === 'ListObjectVersionsCommand',
        ).length
        if (listCallCount === 1) {
          return {
            Versions: [{ Key: source.storageKey, VersionId: 'v2' }],
            DeleteMarkers: [{ Key: source.storageKey, VersionId: 'd1' }],
            IsTruncated: true,
            NextKeyMarker: source.storageKey,
            NextVersionIdMarker: 'v2',
          }
        }
        if (listCallCount === 2) {
          return {
            Versions: [{ Key: source.storageKey, VersionId: 'v1' }],
            IsTruncated: false,
          }
        }
        return { Versions: [], DeleteMarkers: [], IsTruncated: false }
      }
      if (command.constructor.name === 'DeleteObjectsCommand') {
        return { Deleted: [] }
      }
      throw new Error('unexpected_command')
    })
    const credentials = vi.fn() as unknown as ReturnType<
      AwsObjectPurgeDependencies['createCredentialsProvider']
    >
    const createCredentialsProvider = vi.fn<
      AwsObjectPurgeDependencies['createCredentialsProvider']
    >(() => credentials)
    const dependencies: AwsObjectPurgeDependencies = {
      createCredentialsProvider,
      createS3Client: () => ({ send }) as unknown as S3Client,
    }
    const purger = new AwsPropertySourceObjectPurger(config, dependencies)

    await expect(purger.purgeSources([source])).resolves.toEqual({
      deletedVersions: 3,
    })

    const deleteCommand = send.mock.calls
      .map(([command]) => command)
      .find(
        (command) => command.constructor.name === 'DeleteObjectsCommand',
      ) as { input: { Delete: { Objects: unknown[] } } }
    expect(deleteCommand.input.Delete.Objects).toEqual([
      { Key: source.storageKey, VersionId: 'v2' },
      { Key: source.storageKey, VersionId: 'd1' },
      { Key: source.storageKey, VersionId: 'v1' },
    ])

    const credentialsInput = createCredentialsProvider.mock.calls[0][0]
    expect(credentialsInput).toMatchObject({
      roleArn: config.deletionRoleArn,
      roleSessionName:
        'source-delete-11111111111141118111111111111111',
      clientConfig: { region: 'eu-central-1' },
      durationSeconds: 900,
    })
    expect(JSON.parse(credentialsInput.policy!)).toEqual({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:DeleteObject', 's3:DeleteObjectVersion'],
          Resource:
            `arn:aws:s3:::${config.bucket}/` +
            `originals/organizations/${organizationId}/*`,
        },
        {
          Effect: 'Allow',
          Action: 's3:ListBucketVersions',
          Resource: `arn:aws:s3:::${config.bucket}`,
          Condition: {
            StringLike: {
              's3:prefix':
                `originals/organizations/${organizationId}/*`,
            },
          },
        },
      ],
    })
  })

  it('keeps the STS session policy below the AWS limit for many sources', async () => {
    const send = vi.fn(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === 'ListObjectVersionsCommand') {
        return { Versions: [], DeleteMarkers: [], IsTruncated: false }
      }
      throw new Error('unexpected_command')
    })
    const credentials = vi.fn() as unknown as ReturnType<
      AwsObjectPurgeDependencies['createCredentialsProvider']
    >
    const createCredentialsProvider = vi.fn<
      AwsObjectPurgeDependencies['createCredentialsProvider']
    >(() => credentials)
    const purger = new AwsPropertySourceObjectPurger(config, {
      createCredentialsProvider,
      createS3Client: () => ({ send }) as unknown as S3Client,
    })
    const sources = Array.from({ length: 20 }, (_, index) =>
      createSourceForIndex(index),
    )

    await expect(purger.purgeSources(sources)).resolves.toEqual({
      deletedVersions: 0,
    })

    const policy =
      createCredentialsProvider.mock.calls[0][0].policy ?? ''
    expect(Buffer.byteLength(policy, 'utf8')).toBeLessThanOrEqual(2048)
  })

  it('rejects an empty or mixed-organization purge before AWS calls', async () => {
    const createCredentialsProvider = vi.fn()
    const purger = new AwsPropertySourceObjectPurger(config, {
      createCredentialsProvider:
        createCredentialsProvider as AwsObjectPurgeDependencies['createCredentialsProvider'],
      createS3Client: vi.fn(),
    })

    await expect(purger.purgeSources([])).rejects.toThrow(
      'SOURCE_OBJECT_PURGE_EMPTY',
    )
    await expect(
      purger.purgeSources([
        source,
        createSource('99999999-9999-4999-8999-999999999999'),
      ]),
    ).rejects.toThrow('SOURCE_OBJECT_PURGE_MIXED_ORGANIZATIONS')
    expect(createCredentialsProvider).not.toHaveBeenCalled()
  })
})

function createSource(
  sourceOrganizationId = organizationId,
): PropertySource {
  const propertyProjectId =
    sourceOrganizationId === organizationId
      ? '22222222-2222-4222-8222-222222222222'
      : '88888888-8888-4888-8888-888888888888'
  const id =
    sourceOrganizationId === organizationId
      ? '33333333-3333-4333-8333-333333333333'
      : '77777777-7777-4777-8777-777777777777'

  return {
    id,
    organizationId: sourceOrganizationId,
    propertyProjectId,
    storageKey:
      `originals/organizations/${sourceOrganizationId}/properties/` +
      `${propertyProjectId}/sources/${id}/original`,
    fileName: 'synthetic.pdf',
    mediaType: 'application/pdf',
    sizeBytes: 1200,
    checksumSha256: 'a'.repeat(64),
    status: 'review_ready',
    errorCode: null,
    errorMessage: null,
    uploadedAt: new Date(),
    processedAt: new Date(),
    createdByUserId: 'user-a',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function createSourceForIndex(index: number): PropertySource {
  const id =
    `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`
  return {
    ...source,
    id,
    storageKey:
      `originals/organizations/${organizationId}/properties/` +
      `${source.propertyProjectId}/sources/${id}/original`,
  }
}
