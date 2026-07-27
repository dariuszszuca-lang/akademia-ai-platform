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

describe('PropertySourceStorageStack malware protection', () => {
  it('creates a GuardDuty-only scan role with scoped official permissions', () => {
    const template = createTemplate()

    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'malware-protection-plan.guardduty.amazonaws.com',
            },
          },
        ],
        Version: '2012-10-17',
      },
    })

    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: [
              'events:PutRule',
              'events:DeleteRule',
              'events:PutTargets',
              'events:RemoveTargets',
            ],
            Condition: {
              StringLike: {
                'events:ManagedBy':
                  'malware-protection-plan.guardduty.amazonaws.com',
              },
            },
            Effect: 'Allow',
          }),
          Match.objectLike({
            Action: ['events:DescribeRule', 'events:ListTargetsByRule'],
            Effect: 'Allow',
          }),
          Match.objectLike({
            Action: [
              's3:PutObjectTagging',
              's3:GetObjectTagging',
              's3:PutObjectVersionTagging',
              's3:GetObjectVersionTagging',
            ],
            Effect: 'Allow',
          }),
          Match.objectLike({
            Action: ['s3:PutBucketNotification', 's3:GetBucketNotification'],
            Effect: 'Allow',
          }),
          Match.objectLike({
            Action: 's3:PutObject',
            Effect: 'Allow',
          }),
          Match.objectLike({
            Action: 's3:ListBucket',
            Effect: 'Allow',
          }),
          Match.objectLike({
            Action: ['s3:GetObject', 's3:GetObjectVersion'],
            Effect: 'Allow',
          }),
          Match.objectLike({
            Action: ['kms:GenerateDataKey', 'kms:Decrypt'],
            Condition: {
              StringLike: {
                'kms:ViaService': 's3.eu-central-1.amazonaws.com',
              },
            },
            Effect: 'Allow',
          }),
        ]),
      },
    })

    const policies = template.findResources('AWS::IAM::Policy')
    const policyJson = JSON.stringify(policies)
    expect(policyJson).toContain(
      'rule/DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3*',
    )
    expect(policyJson).toContain(
      '/malware-protection-resource-validation-object',
    )
    expect(policyJson).toContain('/originals/*')
    expect(policyJson).not.toContain('"Resource":"*"')
  })

  it('protects only original objects and enables result tagging', () => {
    const template = createTemplate()

    template.resourceCountIs('AWS::GuardDuty::MalwareProtectionPlan', 1)
    template.hasResourceProperties('AWS::GuardDuty::MalwareProtectionPlan', {
      Actions: { Tagging: { Status: 'ENABLED' } },
      ProtectedResource: {
        S3Bucket: {
          BucketName: Match.anyValue(),
          ObjectPrefixes: ['originals/'],
        },
      },
      Role: Match.anyValue(),
    })

    const [plan] = Object.values(
      template.findResources('AWS::GuardDuty::MalwareProtectionPlan'),
    )
    const rolePolicyId = Object.keys(
      template.findResources('AWS::IAM::Policy'),
    )[0]
    const bucketPolicyId = Object.keys(
      template.findResources('AWS::S3::BucketPolicy'),
    )[0]

    expect(plan.DependsOn).toEqual(
      expect.arrayContaining([rolePolicyId, bucketPolicyId]),
    )
  })

  it('denies reads before a clean scan and protects the scan status tag', () => {
    const template = createTemplate()

    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ['s3:GetObject', 's3:GetObjectVersion'],
            Condition: {
              StringNotEquals: {
                's3:ExistingObjectTag/GuardDutyMalwareScanStatus':
                  'NO_THREATS_FOUND',
              },
            },
            Effect: 'Deny',
            NotPrincipal: Match.anyValue(),
          }),
          Match.objectLike({
            Action: ['s3:PutObjectTagging', 's3:PutObjectVersionTagging'],
            Condition: {
              'ForAnyValue:StringEquals': {
                's3:RequestObjectTagKeys': 'GuardDutyMalwareScanStatus',
              },
            },
            Effect: 'Deny',
            NotPrincipal: Match.anyValue(),
          }),
        ]),
      },
    })
  })
})
