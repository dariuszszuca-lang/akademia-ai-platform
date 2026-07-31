import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { App } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { afterAll, describe, expect, it } from 'vitest'
import { AccountSecurityBaselineStack } from './account-security-baseline-stack'

// One synth per file into an owned outdir removed afterwards; a bare
// new App() leaks a cdk.out* directory into the OS tmpdir per synth
// and re-synthesizing in each test made the first test hit the
// vitest timeout on a cold run.
const outdirRoot = mkdtempSync(join(tmpdir(), 'cdk-test-baseline-'))

afterAll(() => {
  rmSync(outdirRoot, { recursive: true, force: true })
})

const cachedTemplate = buildTemplate()

function buildTemplate(): Template {
  const app = new App({ outdir: join(outdirRoot, 'synth') })
  const stack = new AccountSecurityBaselineStack(
    app,
    'TestAccountSecurityBaseline',
    {
      env: {
        account: '261965598943',
        region: 'eu-central-1',
      },
    },
  )

  return Template.fromStack(stack)
}

function createTemplate(): Template {
  return cachedTemplate
}

describe('AccountSecurityBaselineStack retained audit storage', () => {
  it('creates one retained rotating KMS key', () => {
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

  it('creates two retained private versioned KMS buckets', () => {
    const template = createTemplate()
    const buckets = template.findResources('AWS::S3::Bucket')

    expect(Object.keys(buckets)).toHaveLength(2)
    for (const bucket of Object.values(buckets)) {
      expect(bucket.DeletionPolicy).toBe('Retain')
      expect(bucket.UpdateReplacePolicy).toBe('Retain')
      expect(bucket.Properties).toEqual(
        expect.objectContaining({
          BucketEncryption: {
            ServerSideEncryptionConfiguration: [
              expect.objectContaining({
                BucketKeyEnabled: true,
                ServerSideEncryptionByDefault: expect.objectContaining({
                  SSEAlgorithm: 'aws:kms',
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
      )
      expect(
        bucket.Properties.LifecycleConfiguration.Rules,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            AbortIncompleteMultipartUpload: {
              DaysAfterInitiation: 1,
            },
            Status: 'Enabled',
          }),
          expect.objectContaining({
            NoncurrentVersionExpiration: { NoncurrentDays: 90 },
            Status: 'Enabled',
          }),
        ]),
      )
    }
  })

  it('denies insecure transport to both audit buckets', () => {
    const template = createTemplate()
    const policies = template.findResources('AWS::S3::BucketPolicy')

    expect(Object.keys(policies)).toHaveLength(2)
    for (const policy of Object.values(policies)) {
      expect(policy.Properties.PolicyDocument.Statement).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            Action: 's3:*',
            Condition: {
              Bool: { 'aws:SecureTransport': 'false' },
            },
            Effect: 'Deny',
            Principal: { AWS: '*' },
          }),
        ]),
      )
    }
  })
})

describe('AccountSecurityBaselineStack CloudTrail', () => {
  it('records all management events across regions', () => {
    const template = createTemplate()

    template.resourceCountIs('AWS::CloudTrail::Trail', 1)
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      EnableLogFileValidation: true,
      IncludeGlobalServiceEvents: true,
      IsLogging: true,
      IsMultiRegionTrail: true,
      TrailName: 'management-trail',
      EventSelectors: [
        {
          IncludeManagementEvents: true,
          ReadWriteType: 'All',
        },
      ],
      KMSKeyId: Match.anyValue(),
      S3BucketName: Match.anyValue(),
    })
  })

  it('grants CloudTrail scoped access to the audit KMS key', () => {
    const template = createTemplate()
    const key = Object.values(
      template.findResources('AWS::KMS::Key'),
    )[0]
    const statements = key.Properties.KeyPolicy.Statement
    const cloudTrailStatements = statements.filter(
      (statement: {
        Principal?: { Service?: string }
      }) =>
        statement.Principal?.Service ===
        'cloudtrail.amazonaws.com',
    )

    expect(cloudTrailStatements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          Action: expect.arrayContaining([
            'kms:Decrypt',
            'kms:GenerateDataKey*',
          ]),
          Condition: expect.objectContaining({
            StringEquals: expect.objectContaining({
              'aws:SourceArn': expect.anything(),
            }),
            StringLike: expect.objectContaining({
              'kms:EncryptionContext:aws:cloudtrail:arn':
                expect.anything(),
            }),
          }),
        }),
        expect.objectContaining({
          Action: 'kms:DescribeKey',
          Condition: {
            StringEquals: {
              'aws:SourceArn': expect.anything(),
            },
          },
        }),
      ]),
    )

    const policyJson = JSON.stringify(cloudTrailStatements)
    expect(policyJson).toContain(
      ':cloudtrail:eu-central-1:261965598943:trail/management-trail',
    )
    expect(policyJson).toContain(
      ':cloudtrail:*:261965598943:trail/*',
    )
  })
})

describe('AccountSecurityBaselineStack AWS Config', () => {
  it('uses a Config service-linked role and records supported resources', () => {
    const template = createTemplate()

    template.hasResourceProperties('AWS::IAM::ServiceLinkedRole', {
      AWSServiceName: 'config.amazonaws.com',
    })
    template.hasResourceProperties(
      'AWS::Config::ConfigurationRecorder',
      {
        Name: 'default',
        RecordingGroup: {
          AllSupported: true,
          IncludeGlobalResourceTypes: true,
        },
        RoleARN: Match.anyValue(),
      },
    )
    template.hasResourceProperties('AWS::Config::DeliveryChannel', {
      Name: 'default',
      S3BucketName: Match.anyValue(),
      S3KmsKeyArn: Match.anyValue(),
      ConfigSnapshotDeliveryProperties: {
        DeliveryFrequency: 'Six_Hours',
      },
    })
  })

  it('scopes Config delivery to the exact account and region ARN', () => {
    const templateJson = JSON.stringify(createTemplate().toJSON())

    expect(templateJson).toContain(
      ':config:eu-central-1:261965598943:*',
    )
    expect(templateJson).not.toContain(
      ':config:eu-central-1:261965598943:/*',
    )
  })

  it('creates exactly the four required managed rules', () => {
    const template = createTemplate()
    const resources = template.findResources(
      'AWS::Config::ConfigRule',
    )
    const identifiers = Object.values(resources)
      .map(
        (resource) =>
          resource.Properties.Source.SourceIdentifier as string,
      )
      .sort()

    expect(identifiers).toEqual(
      [
        'CLOUD_TRAIL_ENABLED',
        'IAM_USER_MFA_ENABLED',
        'S3_BUCKET_PUBLIC_READ_PROHIBITED',
        'S3_BUCKET_PUBLIC_WRITE_PROHIBITED',
      ].sort(),
    )
  })
})

describe('AccountSecurityBaselineStack ownership', () => {
  it('tags taggable resources for project ownership and cost allocation', () => {
    const template = createTemplate()
    const expectedTags = Match.arrayWith([
      { Key: 'CostCenter', Value: 'PropertyStudio' },
      { Key: 'Env', Value: 'prod' },
      { Key: 'Owner', Value: 'AI-Team' },
      { Key: 'Project', Value: 'PropertyIntelligenceStudio' },
    ])

    template.hasResourceProperties('AWS::KMS::Key', {
      Tags: expectedTags,
    })
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: expectedTags,
    })
  })
})
