import {
  ArnFormat,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  Tags,
} from 'aws-cdk-lib'
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail'
import * as config from 'aws-cdk-lib/aws-config'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as kms from 'aws-cdk-lib/aws-kms'
import * as s3 from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'

const REQUIRED_CONFIG_RULES = [
  {
    name: 's3-bucket-public-read-prohibited',
    identifier: 'S3_BUCKET_PUBLIC_READ_PROHIBITED',
  },
  {
    name: 's3-bucket-public-write-prohibited',
    identifier: 'S3_BUCKET_PUBLIC_WRITE_PROHIBITED',
  },
  {
    name: 'iam-user-mfa-enabled',
    identifier: 'IAM_USER_MFA_ENABLED',
  },
  {
    name: 'cloudtrail-enabled',
    identifier: 'CLOUD_TRAIL_ENABLED',
  },
] as const

export class AccountSecurityBaselineStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)

    Tags.of(this).add('Project', 'PropertyIntelligenceStudio')
    Tags.of(this).add('Env', 'prod')
    Tags.of(this).add('Owner', 'AI-Team')
    Tags.of(this).add('CostCenter', 'PropertyStudio')

    const encryptionKey = new kms.Key(this, 'AccountAuditKey', {
      alias: 'alias/property-studio-account-audit',
      description:
        'Encrypts CloudTrail and AWS Config records for Property Intelligence Studio',
      enableKeyRotation: true,
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      removalPolicy: RemovalPolicy.RETAIN,
      pendingWindow: Duration.days(30),
    })

    const cloudTrailBucket = createAuditBucket(
      this,
      'CloudTrailLogs',
      `cloudtrail-logs-${this.account}-${this.region}`,
      encryptionKey,
    )
    const configBucket = createAuditBucket(
      this,
      'ConfigLogs',
      `aws-config-logs-${this.account}-${this.region}`,
      encryptionKey,
    )

    const cloudTrailService = new iam.ServicePrincipal(
      'cloudtrail.amazonaws.com',
    )
    const managementTrailArn = this.formatArn({
      service: 'cloudtrail',
      resource: 'trail',
      resourceName: 'management-trail',
      arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    })
    const cloudTrailEncryptionContextArn = this.formatArn({
      service: 'cloudtrail',
      region: '*',
      resource: 'trail',
      resourceName: '*',
      arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    })

    encryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudTrailEncryptLogs',
        principals: [cloudTrailService],
        actions: ['kms:Decrypt', 'kms:GenerateDataKey*'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'aws:SourceArn': managementTrailArn,
          },
          StringLike: {
            'kms:EncryptionContext:aws:cloudtrail:arn':
              cloudTrailEncryptionContextArn,
          },
        },
      }),
    )
    encryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudTrailDescribeKey',
        principals: [cloudTrailService],
        actions: ['kms:DescribeKey'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'aws:SourceArn': managementTrailArn,
          },
        },
      }),
    )

    new cloudtrail.Trail(this, 'ManagementTrail', {
      trailName: 'management-trail',
      bucket: cloudTrailBucket,
      encryptionKey,
      enableFileValidation: true,
      includeGlobalServiceEvents: true,
      isMultiRegionTrail: true,
      managementEvents: cloudtrail.ReadWriteType.ALL,
      sendToCloudWatchLogs: false,
    })

    const configService = new iam.ServicePrincipal(
      'config.amazonaws.com',
    )
    const configSourceArn = this.formatArn({
      service: 'config',
      resource: '*',
      arnFormat: ArnFormat.NO_RESOURCE_NAME,
    })

    encryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowAwsConfigDelivery',
        principals: [configService],
        actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'AWS:SourceAccount': this.account,
          },
          ArnLike: {
            'AWS:SourceArn': configSourceArn,
          },
        },
      }),
    )

    configBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AWSConfigBucketPermissionsCheck',
        principals: [configService],
        actions: ['s3:GetBucketAcl', 's3:ListBucket'],
        resources: [configBucket.bucketArn],
        conditions: {
          StringEquals: {
            'AWS:SourceAccount': this.account,
          },
          ArnLike: {
            'AWS:SourceArn': configSourceArn,
          },
        },
      }),
    )
    configBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AWSConfigBucketDelivery',
        principals: [configService],
        actions: ['s3:PutObject'],
        resources: [
          configBucket.arnForObjects(
            `AWSLogs/${this.account}/Config/*`,
          ),
        ],
        conditions: {
          StringEquals: {
            's3:x-amz-acl': 'bucket-owner-full-control',
            'AWS:SourceAccount': this.account,
          },
          ArnLike: {
            'AWS:SourceArn': configSourceArn,
          },
        },
      }),
    )

    const serviceLinkedRole = new iam.CfnServiceLinkedRole(
      this,
      'ConfigServiceLinkedRole',
      {
        awsServiceName: 'config.amazonaws.com',
        description:
          'Allows AWS Config to inventory account resources',
      },
    )
    const serviceLinkedRoleArn = this.formatArn({
      service: 'iam',
      region: '',
      resource: 'role',
      resourceName:
        'aws-service-role/config.amazonaws.com/AWSServiceRoleForConfig',
      arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    })

    const recorder = new config.CfnConfigurationRecorder(
      this,
      'ConfigurationRecorder',
      {
        name: 'default',
        roleArn: serviceLinkedRoleArn,
        recordingGroup: {
          allSupported: true,
          includeGlobalResourceTypes: true,
        },
        recordingMode: {
          recordingFrequency: 'CONTINUOUS',
        },
      },
    )
    recorder.node.addDependency(serviceLinkedRole)

    const deliveryChannel = new config.CfnDeliveryChannel(
      this,
      'DeliveryChannel',
      {
        name: 'default',
        s3BucketName: configBucket.bucketName,
        s3KmsKeyArn: encryptionKey.keyArn,
        configSnapshotDeliveryProperties: {
          deliveryFrequency: 'Six_Hours',
        },
      },
    )
    if (configBucket.policy) {
      deliveryChannel.node.addDependency(configBucket.policy)
    }

    for (const ruleConfig of REQUIRED_CONFIG_RULES) {
      const rule = new config.CfnConfigRule(
        this,
        configRuleLogicalId(ruleConfig.name),
        {
          configRuleName: ruleConfig.name,
          source: {
            owner: 'AWS',
            sourceIdentifier: ruleConfig.identifier,
          },
        },
      )
      rule.node.addDependency(recorder)
      rule.node.addDependency(deliveryChannel)
    }
  }
}

function createAuditBucket(
  scope: Construct,
  id: string,
  bucketName: string,
  encryptionKey: kms.IKey,
): s3.Bucket {
  return new s3.Bucket(scope, id, {
    bucketName,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.KMS,
    encryptionKey,
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
        id: 'expire-noncurrent-versions',
        noncurrentVersionExpiration: Duration.days(90),
      },
    ],
  })
}

function configRuleLogicalId(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
