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
  studioCallbackBaseUrl: 'https://akademia-ai-platform.vercel.app',
  billingAlertEmail: 'alerts@example.com',
})

function buildTemplate(stackConfig = config): Template {
  const app = new App()
  const stack = new PropertySourceStorageStack(app, 'TestStorage', {
    env: { account: stackConfig.account, region: stackConfig.region },
    config: stackConfig,
  })

  return Template.fromStack(stack)
}

const cachedDefaultTemplate = buildTemplate(config)

function createTemplate(stackConfig = config): Template {
  return stackConfig === config
    ? cachedDefaultTemplate
    : buildTemplate(stackConfig)
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

    const bucketPolicy = Object.values(
      template.findResources('AWS::S3::BucketPolicy'),
    )[0]
    const cleanReadStatement =
      bucketPolicy.Properties.PolicyDocument.Statement.find(
        (statement: { Sid?: string }) =>
          statement.Sid === 'NoReadUnlessClean',
      )
    expect(JSON.stringify(cleanReadStatement.Resource)).toContain(
      '/originals/*',
    )
    expect(JSON.stringify(cleanReadStatement.Resource)).not.toContain(
      '/work/*',
    )
  })
})

describe('PropertySourceStorageStack Vercel OIDC signer', () => {
  it('creates one team-scoped provider with the AWS STS audience', () => {
    const template = createTemplate()

    template.resourceCountIs('AWS::IAM::OIDCProvider', 1)
    template.hasResourceProperties('AWS::IAM::OIDCProvider', {
      ClientIdList: ['sts.amazonaws.com'],
      Url: 'https://oidc.vercel.com/ai-team',
    })
  })

  it(
    'imports a matching provider without creating a duplicate',
    () => {
      const template = createTemplate(
        parseInfrastructureConfig({
          ...config,
          oidcProviderArn:
            'arn:aws:iam::111122223333:oidc-provider/oidc.vercel.com/ai-team',
        }),
      )

      template.resourceCountIs('AWS::IAM::OIDCProvider', 0)
      const roles = template.findResources('AWS::IAM::Role')
      expect(JSON.stringify(roles)).toContain(
        'arn:aws:iam::111122223333:oidc-provider/oidc.vercel.com/ai-team',
      )
    },
    20_000,
  )

  it('trusts only exact Vercel subjects through web identity', () => {
    const template = createTemplate()
    const roles = template.findResources('AWS::IAM::Role')
    const signerRole = Object.values(roles).find((role) =>
      JSON.stringify(role).includes('sts:AssumeRoleWithWebIdentity'),
    )

    expect(signerRole).toBeDefined()
    expect(signerRole?.Properties.AssumeRolePolicyDocument).toEqual({
      Statement: [
        expect.objectContaining({
          Action: 'sts:AssumeRoleWithWebIdentity',
          Condition: {
            StringEquals: {
              'oidc.vercel.com/ai-team:aud': 'sts.amazonaws.com',
              'oidc.vercel.com/ai-team:sub': [
                'owner:ai-team:project:akademia-ai-platform:environment:development',
                'owner:ai-team:project:akademia-ai-platform:environment:preview',
              ],
            },
          },
          Effect: 'Allow',
          Principal: { Federated: expect.anything() },
        }),
      ],
      Version: '2012-10-17',
    })

    const trustJson = JSON.stringify(
      signerRole?.Properties.AssumeRolePolicyDocument,
    )
    expect(trustJson).not.toContain('StringLike')
    expect(trustJson).not.toContain(
      'owner:ai-team:project:akademia-ai-platform:environment:*',
    )
  })

  it('limits the signer role to originals and one KMS key', () => {
    const template = createTemplate()
    const roles = template.findResources('AWS::IAM::Role')
    const signerRoleEntry = Object.entries(roles).find(([, role]) =>
      JSON.stringify(role).includes('sts:AssumeRoleWithWebIdentity'),
    )

    expect(signerRoleEntry).toBeDefined()
    const [signerRoleId] = signerRoleEntry!
    const policies = template.findResources('AWS::IAM::Policy')
    const signerPolicy = Object.values(policies).find((policy) =>
      JSON.stringify(policy.Properties.Roles).includes(signerRoleId),
    )

    expect(signerPolicy).toBeDefined()
    expect(
      signerPolicy?.Properties.PolicyDocument.Statement,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          Action: 's3:PutObject',
          Effect: 'Allow',
        }),
        expect.objectContaining({
          Action: ['s3:GetObject', 's3:GetObjectTagging'],
          Effect: 'Allow',
        }),
        expect.objectContaining({
          Action: ['kms:GenerateDataKey', 'kms:Encrypt', 'kms:Decrypt'],
          Effect: 'Allow',
        }),
      ]),
    )

    const policyJson = JSON.stringify(signerPolicy)
    expect(policyJson).toContain('/originals/*')
    expect(policyJson).not.toContain('s3:ListBucket')
    expect(policyJson).not.toContain('s3:PutObjectTagging')
    expect(policyJson).not.toMatch(
      /bedrock:|transcribe:|events:|states:|s3:\*/,
    )
    expect(policyJson).not.toContain('"Resource":"*"')
  })

  it('exports only non-secret deployment identifiers', () => {
    const template = createTemplate()
    const outputs = template.toJSON().Outputs

    expect(Object.keys(outputs)).toEqual(
      expect.arrayContaining([
        'PropertySourceBucketName',
        'PropertySourceKmsKeyArn',
        'PropertySourceSignerRoleArn',
        'PropertySourceRegion',
        'PropertySourceMalwareProtectionPlanId',
      ]),
    )
    expect(JSON.stringify(outputs)).not.toMatch(
      /AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY/,
    )
  })
})

describe('PropertySourceStorageStack cost guardrails', () => {
  it('alerts at 50, 80 and 100 percent of the USD 10 dev budget', () => {
    const template = createTemplate()

    template.resourceCountIs('AWS::Budgets::Budget', 1)
    template.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({
        BudgetLimit: { Amount: 10, Unit: 'USD' },
        BudgetType: 'COST',
        FilterExpression: {
          And: [
            {
              Tags: {
                Key: 'CostCenter',
                MatchOptions: ['EQUALS'],
                Values: ['PropertyStudio'],
              },
            },
            {
              Tags: {
                Key: 'Env',
                MatchOptions: ['EQUALS'],
                Values: ['dev'],
              },
            },
          ],
        },
        TimeUnit: 'MONTHLY',
      }),
      NotificationsWithSubscribers: [
        {
          Notification: {
            ComparisonOperator: 'GREATER_THAN',
            NotificationType: 'ACTUAL',
            Threshold: 50,
            ThresholdType: 'PERCENTAGE',
          },
          Subscribers: [
            {
              Address: 'alerts@example.com',
              SubscriptionType: 'EMAIL',
            },
          ],
        },
        {
          Notification: {
            ComparisonOperator: 'GREATER_THAN',
            NotificationType: 'ACTUAL',
            Threshold: 80,
            ThresholdType: 'PERCENTAGE',
          },
          Subscribers: [
            {
              Address: 'alerts@example.com',
              SubscriptionType: 'EMAIL',
            },
          ],
        },
        {
          Notification: {
            ComparisonOperator: 'GREATER_THAN',
            NotificationType: 'ACTUAL',
            Threshold: 100,
            ThresholdType: 'PERCENTAGE',
          },
          Subscribers: [
            {
              Address: 'alerts@example.com',
              SubscriptionType: 'EMAIL',
            },
          ],
        },
      ],
    })
  })

  it(
    'uses a separate USD 25 production alert budget',
    () => {
      const prodConfig = parseInfrastructureConfig({
        ...config,
        studioEnv: 'prod',
        vercelEnvironments: ['production'],
      })
      const template = createTemplate(prodConfig)

      template.hasResourceProperties('AWS::Budgets::Budget', {
        Budget: Match.objectLike({
          BudgetLimit: { Amount: 25, Unit: 'USD' },
          BudgetType: 'COST',
          TimeUnit: 'MONTHLY',
        }),
      })
    },
    20_000,
  )

  it('gives every deployment output a stable description', () => {
    const outputs = createTemplate().toJSON().Outputs

    expect(outputs).toMatchObject({
      PropertySourceBucketName: {
        Description: 'Private property source bucket name',
      },
      PropertySourceKmsKeyArn: {
        Description: 'Property source KMS key ARN',
      },
      PropertySourceSignerRoleArn: {
        Description: 'Vercel OIDC property source signer role ARN',
      },
      PropertySourceRegion: {
        Description: 'Property source AWS region',
      },
      PropertySourceMalwareProtectionPlanId: {
        Description:
          'GuardDuty property source malware protection plan ID',
      },
    })
  })
})

describe('PropertySourceStorageStack extraction pipeline foundation', () => {
  it('routes exact GuardDuty object scans to a bounded starter target and encrypted DLQ', () => {
    const template = createTemplate()

    template.resourceCountIs('AWS::SQS::Queue', 1)
    template.hasResourceProperties('AWS::SQS::Queue', {
      MessageRetentionPeriod: 1_209_600,
      SqsManagedSseEnabled: true,
    })
    template.resourceCountIs('AWS::Events::Rule', 1)
    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        source: ['aws.guardduty'],
        'detail-type': [
          'GuardDuty Malware Protection Object Scan Result',
        ],
        detail: {
          resourceType: ['S3_OBJECT'],
          s3ObjectDetails: {
            bucketName: [Match.anyValue()],
            objectKey: [{ prefix: 'originals/' }],
          },
        },
      },
      State: 'ENABLED',
      Targets: [
        Match.objectLike({
          DeadLetterConfig: { Arn: Match.anyValue() },
          RetryPolicy: {
            MaximumEventAgeInSeconds: 3600,
            MaximumRetryAttempts: 2,
          },
        }),
      ],
    })
  })

  it('creates five isolated bundled Node.js 24 workers with bounded logs', () => {
    const template = createTemplate()

    template.resourceCountIs('AWS::Lambda::Function', 5)
    template.resourceCountIs('AWS::Lambda::Alias', 5)
    template.allResourcesProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      MemorySize: Match.anyValue(),
      Timeout: Match.anyValue(),
      ReservedConcurrentExecutions: Match.absent(),
    })
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'property-source-pipeline-dev-starter',
      Timeout: 10,
      Environment: {
        Variables: Match.objectLike({
          SELECTED_BUCKET: Match.anyValue(),
          PIPELINE_VERSION: 'property-source-v1',
          STATE_MACHINE_ARN: Match.anyValue(),
        }),
      },
    })
    for (const worker of [
      'callback',
      'validator',
      'evidence',
      'proposals',
    ]) {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `property-source-pipeline-dev-${worker}`,
      })
    }
    template.resourceCountIs('AWS::Logs::LogGroup', 5)
    template.allResourcesProperties('AWS::Logs::LogGroup', {
      RetentionInDays: 3,
    })

    const functions = template.findResources('AWS::Lambda::Function')
    expect(JSON.stringify(functions)).not.toContain('"ZipFile"')
    expect(JSON.stringify(functions)).not.toContain(
      'PROPERTY_SOURCE_CALLBACK_SECRET',
    )
  })

  it('allows the starter to start only its one Standard workflow', () => {
    const template = createTemplate()

    template.resourceCountIs('AWS::StepFunctions::StateMachine', 1)
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      StateMachineType: 'STANDARD',
    })

    const stateMachine = Object.values(
      template.findResources('AWS::StepFunctions::StateMachine'),
    )[0]
    const definition = JSON.stringify(
      stateMachine.Properties.DefinitionString ??
        stateMachine.Properties.Definition,
    )
    expect(definition).toContain('CallbackContext')
    expect(definition).toContain('ValidateObject')
    expect(definition).toContain('MapEvidence')
    expect(definition).toContain('BuildProposals')
    expect(definition).toContain('SubmitResult')
    expect(definition).toContain('TechnicalFailureResult')
    expect(definition).toContain('States.TaskFailed')
    expect(definition).not.toContain('FoundationWorker')
    expect(definition).toContain('Retry')
    expect(definition).toContain('BackoffRate')
    expect(definition).toContain('MaxAttempts')
    expect(definition).toContain('Catch')
    expect(definition).toContain('States.ALL')
    expect(stateMachine.Properties).not.toHaveProperty(
      'LoggingConfiguration',
    )

    const policies = template.findResources('AWS::IAM::Policy')
    const startStatements = Object.values(policies)
      .flatMap((policy) => policy.Properties.PolicyDocument.Statement)
      .filter((statement) =>
        ([] as string[])
          .concat(statement.Action)
          .includes('states:StartExecution'),
      )
    expect(startStatements).toHaveLength(1)
    expect(startStatements[0].Resource).not.toBe('*')
    expect(JSON.stringify(policies)).not.toContain('"Resource":"*"')
  })

  it('scopes callback, S3, KMS and Bedrock worker permissions to exact resources', () => {
    const template = createTemplate()
    const policies = JSON.stringify(
      template.findResources('AWS::IAM::Policy'),
    )

    expect(policies).toContain('secretsmanager:GetSecretValue')
    expect(policies).toContain('s3:PutObject')
    expect(policies).toContain('/work/*')
    expect(policies).toContain('kms:GenerateDataKey')
    expect(policies).toContain('bedrock:InvokeModel')
    expect(policies).toContain(
      'eu.anthropic.claude-sonnet-4-6',
    )
    expect(policies).toContain(
      'foundation-model/anthropic.claude-sonnet-4-6',
    )
    expect(policies).not.toContain('transcribe:StartTranscriptionJob')
    expect(policies).not.toContain('"Action":"bedrock:*"')
    expect(policies).not.toContain('"Resource":"*"')
  })

  it(
    'generates or imports one retained callback secret without outputting its value',
    () => {
      const generated = createTemplate()

      generated.resourceCountIs('AWS::SecretsManager::Secret', 1)
      generated.hasResource('AWS::SecretsManager::Secret', {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Properties: Match.objectLike({
          GenerateSecretString: {
            ExcludePunctuation: true,
            PasswordLength: 64,
          },
        }),
      })

      const imported = createTemplate(
        parseInfrastructureConfig({
          ...config,
          callbackSecretArn:
            'arn:aws:secretsmanager:eu-central-1:111122223333:secret:property-studio/dev/source-callback-AbCd12',
        }),
      )
      imported.resourceCountIs('AWS::SecretsManager::Secret', 0)
      expect(JSON.stringify(imported.toJSON())).toContain(
        'property-studio/dev/source-callback-AbCd12',
      )

      const outputs = generated.toJSON().Outputs
      expect(outputs).toHaveProperty(
        'PropertySourcePipelineStateMachineArn',
      )
      expect(outputs).toHaveProperty('PropertySourceCallbackSecretArn')
      expect(outputs).toHaveProperty('PropertySourcePipelineVersion')
      expect(JSON.stringify(outputs)).not.toContain('SecretString')
    },
    20_000,
  )

  it('adds failure alarms and one operations dashboard without custom high-cardinality metrics', () => {
    const template = createTemplate()

    template.resourceCountIs('AWS::CloudWatch::Alarm', 4)
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1)
    const alarms = template.findResources('AWS::CloudWatch::Alarm')
    const metricNames = Object.values(alarms).map(
      (alarm) => alarm.Properties.MetricName,
    )

    expect(metricNames).toEqual(
      expect.arrayContaining([
        'Errors',
        'ExecutionsFailed',
        'ExecutionsTimedOut',
        'ApproximateNumberOfMessagesVisible',
      ]),
    )
    expect(JSON.stringify(alarms)).not.toContain('DocumentText')
    expect(JSON.stringify(alarms)).not.toContain('SourceId')
  })
})
