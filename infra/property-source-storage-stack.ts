import {
  ArnFormat,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  Tags,
} from 'aws-cdk-lib'
import * as guardduty from 'aws-cdk-lib/aws-guardduty'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as kms from 'aws-cdk-lib/aws-kms'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as budgets from 'aws-cdk-lib/aws-budgets'
import type { Construct } from 'constructs'
import type { InfrastructureConfig } from './config'
import { PropertySourcePipeline } from './property-source-pipeline'

export interface PropertySourceStorageStackProps extends StackProps {
  config: InfrastructureConfig
}

export class PropertySourceStorageStack extends Stack {
  readonly bucket: s3.Bucket
  readonly encryptionKey: kms.Key

  constructor(
    scope: Construct,
    id: string,
    props: PropertySourceStorageStackProps,
  ) {
    super(scope, id, props)

    const { config } = props

    Tags.of(this).add('Project', 'PropertyIntelligenceStudio')
    Tags.of(this).add('Env', config.studioEnv)
    Tags.of(this).add('Owner', 'AI-Team')
    Tags.of(this).add('CostCenter', 'PropertyStudio')

    this.encryptionKey = new kms.Key(this, 'PropertySourceKey', {
      description: `Property Intelligence Studio source files (${config.studioEnv})`,
      enableKeyRotation: true,
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      removalPolicy: RemovalPolicy.RETAIN,
      pendingWindow: Duration.days(30),
    })

    this.bucket = new s3.Bucket(this, 'PropertySourceBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      bucketKeyEnabled: true,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'abort-incomplete-multipart-uploads',
          abortIncompleteMultipartUploadAfter: Duration.days(1),
        },
        {
          id: 'expire-work-files',
          prefix: 'work/',
          expiration: Duration.days(7),
        },
        {
          id: 'expire-transcripts',
          prefix: 'transcripts/',
          expiration: Duration.days(7),
        },
        {
          id: 'expire-noncurrent-versions',
          noncurrentVersionExpiration: Duration.days(90),
        },
      ],
      cors: [
        {
          allowedHeaders: [
            'content-type',
            'x-amz-checksum-sha256',
            'x-amz-meta-source-id',
            'x-amz-server-side-encryption',
            'x-amz-server-side-encryption-aws-kms-key-id',
          ],
          allowedMethods: [s3.HttpMethods.POST],
          allowedOrigins: config.vercelProjectNames.map(
            (project) => `https://${project}.vercel.app`,
          ),
          exposedHeaders: ['etag'],
          maxAge: 300,
        },
      ],
    })

    const malwareRole = new iam.Role(this, 'PropertySourceMalwareRole', {
      assumedBy: new iam.ServicePrincipal(
        'malware-protection-plan.guardduty.amazonaws.com',
      ),
      description:
        'Scans Property Intelligence Studio source files with GuardDuty',
    })

    const guardDutyRuleArn = this.formatArn({
      service: 'events',
      resource: 'rule',
      resourceName: 'DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3*',
      arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    })
    const originalsArn = this.bucket.arnForObjects('originals/*')

    malwareRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'events:PutRule',
          'events:DeleteRule',
          'events:PutTargets',
          'events:RemoveTargets',
        ],
        resources: [guardDutyRuleArn],
        conditions: {
          StringLike: {
            'events:ManagedBy':
              'malware-protection-plan.guardduty.amazonaws.com',
          },
        },
      }),
    )
    malwareRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['events:DescribeRule', 'events:ListTargetsByRule'],
        resources: [guardDutyRuleArn],
      }),
    )
    malwareRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          's3:PutObjectTagging',
          's3:GetObjectTagging',
          's3:PutObjectVersionTagging',
          's3:GetObjectVersionTagging',
        ],
        resources: [originalsArn],
      }),
    )
    malwareRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutBucketNotification', 's3:GetBucketNotification'],
        resources: [this.bucket.bucketArn],
      }),
    )
    malwareRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject'],
        resources: [
          this.bucket.arnForObjects(
            'malware-protection-resource-validation-object',
          ),
        ],
      }),
    )
    malwareRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [this.bucket.bucketArn],
      }),
    )
    malwareRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:GetObjectVersion'],
        resources: [originalsArn],
      }),
    )
    malwareRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['kms:GenerateDataKey', 'kms:Decrypt'],
        resources: [this.encryptionKey.keyArn],
        conditions: {
          StringLike: {
            'kms:ViaService': `s3.${config.region}.amazonaws.com`,
          },
        },
      }),
    )

    const guardDutyAssumedRoleArn = this.formatArn({
      service: 'sts',
      region: '',
      resource: 'assumed-role',
      resourceName: `${malwareRole.roleName}/GuardDutyMalwareProtection`,
      arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    })
    const guardDutyPrincipals = [
      new iam.ArnPrincipal(malwareRole.roleArn),
      new iam.ArnPrincipal(guardDutyAssumedRoleArn),
    ]

    this.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'NoReadUnlessClean',
        effect: iam.Effect.DENY,
        notPrincipals: guardDutyPrincipals,
        actions: ['s3:GetObject', 's3:GetObjectVersion'],
        resources: [originalsArn],
        conditions: {
          StringNotEquals: {
            's3:ExistingObjectTag/GuardDutyMalwareScanStatus':
              'NO_THREATS_FOUND',
          },
        },
      }),
    )
    this.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'OnlyGuardDutyCanTagScanStatus',
        effect: iam.Effect.DENY,
        notPrincipals: guardDutyPrincipals,
        actions: ['s3:PutObjectTagging', 's3:PutObjectVersionTagging'],
        resources: [this.bucket.arnForObjects('*')],
        conditions: {
          'ForAnyValue:StringEquals': {
            's3:RequestObjectTagKeys': 'GuardDutyMalwareScanStatus',
          },
        },
      }),
    )

    const malwareProtectionPlan = new guardduty.CfnMalwareProtectionPlan(
      this,
      'PropertySourceMalwareProtection',
      {
        role: malwareRole.roleArn,
        protectedResource: {
          s3Bucket: {
            bucketName: this.bucket.bucketName,
            objectPrefixes: ['originals/'],
          },
        },
        actions: { tagging: { status: 'ENABLED' } },
      },
    )

    const rolePolicy = malwareRole.node.findChild('DefaultPolicy')
    malwareProtectionPlan.node.addDependency(rolePolicy)
    if (this.bucket.policy) {
      malwareProtectionPlan.node.addDependency(this.bucket.policy)
    }

    const oidcProviderArn =
      config.oidcProviderArn ??
      new iam.CfnOIDCProvider(this, 'VercelOidcProvider', {
        url: `https://oidc.vercel.com/${config.vercelTeamSlug}`,
        clientIdList: ['sts.amazonaws.com'],
      }).attrArn
    const issuerConditionPrefix =
      `oidc.vercel.com/${config.vercelTeamSlug}`
    const signerRole = new iam.Role(this, 'PropertySourceSignerRole', {
      assumedBy: new iam.WebIdentityPrincipal(
        oidcProviderArn,
        {
          StringEquals: {
            [`${issuerConditionPrefix}:aud`]: 'sts.amazonaws.com',
            [`${issuerConditionPrefix}:sub`]: config.vercelSubjects,
          },
        },
      ),
      description:
        'Signs exact Property Intelligence Studio S3 uploads and clean downloads',
      maxSessionDuration: Duration.hours(1),
    })

    signerRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject'],
        resources: [originalsArn],
      }),
    )

    const deletionRole = new iam.Role(
      this,
      'PropertySourceDeletionRole',
      {
        assumedBy: new iam.WebIdentityPrincipal(
          oidcProviderArn,
          {
            StringEquals: {
              [`${issuerConditionPrefix}:aud`]: 'sts.amazonaws.com',
              [`${issuerConditionPrefix}:sub`]:
                config.vercelSubjects,
            },
          },
        ),
        description:
          'Deletes exact Property Intelligence Studio source versions during account erasure',
        maxSessionDuration: Duration.hours(1),
      },
    )
    deletionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:DeleteObject', 's3:DeleteObjectVersion'],
        resources: [
          this.bucket.arnForObjects(
            'originals/organizations/*',
          ),
        ],
      }),
    )
    deletionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucketVersions'],
        resources: [this.bucket.bucketArn],
        conditions: {
          StringLike: {
            's3:prefix': 'originals/organizations/*',
          },
        },
      }),
    )
    signerRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:GetObjectTagging'],
        resources: [originalsArn],
      }),
    )
    signerRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['kms:GenerateDataKey', 'kms:Encrypt', 'kms:Decrypt'],
        resources: [this.encryptionKey.keyArn],
        conditions: {
          StringEquals: {
            'kms:ViaService': `s3.${config.region}.amazonaws.com`,
          },
        },
      }),
    )

    const notificationsWithSubscribers = config.billingAlertEmail
      ? [50, 80, 100].map((threshold) => ({
          notification: {
            comparisonOperator: 'GREATER_THAN',
            notificationType: 'ACTUAL',
            threshold,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              address: config.billingAlertEmail!,
              subscriptionType: 'EMAIL',
            },
          ],
        }))
      : undefined

    new budgets.CfnBudget(this, 'PropertySourceMonthlyBudget', {
      budget: {
        budgetLimit: {
          amount: config.studioEnv === 'prod' ? 25 : 10,
          unit: 'USD',
        },
        budgetName:
          `property-intelligence-studio-${config.studioEnv}-monthly`,
        budgetType: 'COST',
        filterExpression: {
          and: [
            {
              tags: {
                key: 'CostCenter',
                matchOptions: ['EQUALS'],
                values: ['PropertyStudio'],
              },
            },
            {
              tags: {
                key: 'Env',
                matchOptions: ['EQUALS'],
                values: [config.studioEnv],
              },
            },
          ],
        },
        timeUnit: 'MONTHLY',
      },
      notificationsWithSubscribers,
    })

    new PropertySourcePipeline(this, 'ExtractionPipeline', {
      bucket: this.bucket,
      encryptionKey: this.encryptionKey,
      config,
    })

    new CfnOutput(this, 'PropertySourceBucketName', {
      description: 'Private property source bucket name',
      value: this.bucket.bucketName,
    })
    new CfnOutput(this, 'PropertySourceKmsKeyArn', {
      description: 'Property source KMS key ARN',
      value: this.encryptionKey.keyArn,
    })
    new CfnOutput(this, 'PropertySourceSignerRoleArn', {
      description: 'Vercel OIDC property source signer role ARN',
      value: signerRole.roleArn,
    })
    new CfnOutput(this, 'PropertySourceDeletionRoleArn', {
      description: 'Vercel OIDC property source deletion role ARN',
      value: deletionRole.roleArn,
    })
    new CfnOutput(this, 'PropertySourceRegion', {
      description: 'Property source AWS region',
      value: config.region,
    })
    new CfnOutput(this, 'PropertySourceMalwareProtectionPlanId', {
      description: 'GuardDuty property source malware protection plan ID',
      value: malwareProtectionPlan.attrMalwareProtectionPlanId,
    })
  }
}
