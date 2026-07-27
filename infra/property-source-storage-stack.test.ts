import { App } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { describe, expect, it } from 'vitest'
import { parseInfrastructureConfig } from './config'
import { PropertySourceStorageStack } from './property-source-storage-stack'

const config = parseInfrastructureConfig({
  studioEnv: 'dev',
  region: 'eu-central-1',
  account: '111122223333',
  vercelTeamSlug: 'ai-team',
  vercelProjectNames: ['akademia-ai-platform'],
  vercelEnvironments: ['development', 'preview'],
  billingAlertEmail: 'alerts@example.com',
})

function createTemplate(): Template {
  const app = new App()
  const stack = new PropertySourceStorageStack(app, 'TestStorage', {
    env: { account: config.account, region: config.region },
    config,
  })

  return Template.fromStack(stack)
}

describe('PropertySourceStorageStack storage foundation', () => {
  it('creates one retained, rotating customer-managed KMS key', () => {
    const template = createTemplate()

    template.resourceCountIs('AWS::KMS::Key', 1)
    template.hasResource('AWS::KMS::Key', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
      Properties: Match.objectLike({
        EnableKeyRotation: true,
        KeySpec: 'SYMMETRIC_DEFAULT',
        KeyUsage: 'ENCRYPT_DECRYPT',
      }),
    })
  })

  it('creates one private, versioned and KMS-encrypted bucket', () => {
    const template = createTemplate()

    template.resourceCountIs('AWS::S3::Bucket', 1)
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
      Properties: Match.objectLike({
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            Match.objectLike({
              BucketKeyEnabled: true,
              ServerSideEncryptionByDefault: Match.objectLike({
                SSEAlgorithm: 'aws:kms',
                KMSMasterKeyID: Match.anyValue(),
              }),
            }),
          ],
        },
        OwnershipControls: {
          Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }],
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
        VersioningConfiguration: { Status: 'Enabled' },
      }),
    })
  })

  it('enforces TLS without granting public access', () => {
    const template = createTemplate()

    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Principal: { AWS: '*' },
            Action: 's3:*',
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
          }),
        ]),
      },
    })

    const policy = template.findResources('AWS::S3::BucketPolicy')
    expect(JSON.stringify(policy)).not.toContain('"Effect":"Allow","Principal":"*"')
  })

  it('expires temporary objects and old versions', () => {
    const template = createTemplate()

    template.hasResourceProperties('AWS::S3::Bucket', {
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
            Status: 'Enabled',
          }),
          Match.objectLike({
            ExpirationInDays: 7,
            Prefix: 'work/',
            Status: 'Enabled',
          }),
          Match.objectLike({
            ExpirationInDays: 7,
            Prefix: 'transcripts/',
            Status: 'Enabled',
          }),
          Match.objectLike({
            NoncurrentVersionExpiration: { NoncurrentDays: 90 },
            Status: 'Enabled',
          }),
        ]),
      },
    })
  })

  it('allows browser uploads only from exact project origins', () => {
    const template = createTemplate()

    template.hasResourceProperties('AWS::S3::Bucket', {
      CorsConfiguration: {
        CorsRules: [
          {
            AllowedHeaders: [
              'content-type',
              'x-amz-checksum-sha256',
              'x-amz-meta-source-id',
              'x-amz-server-side-encryption',
              'x-amz-server-side-encryption-aws-kms-key-id',
            ],
            AllowedMethods: ['POST'],
            AllowedOrigins: ['https://akademia-ai-platform.vercel.app'],
            ExposedHeaders: ['etag'],
            MaxAge: 300,
          },
        ],
      },
    })
  })

  it('tags storage resources for ownership and cost allocation', () => {
    const template = createTemplate()
    const expectedTags = Match.arrayWith([
      { Key: 'CostCenter', Value: 'PropertyStudio' },
      { Key: 'Env', Value: 'dev' },
      { Key: 'Owner', Value: 'AI-Team' },
      { Key: 'Project', Value: 'PropertyIntelligenceStudio' },
    ])

    template.hasResourceProperties('AWS::KMS::Key', { Tags: expectedTags })
    template.hasResourceProperties('AWS::S3::Bucket', { Tags: expectedTags })
  })
})
