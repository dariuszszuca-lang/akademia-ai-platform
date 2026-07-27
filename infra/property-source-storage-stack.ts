import {
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  Tags,
} from 'aws-cdk-lib'
import * as kms from 'aws-cdk-lib/aws-kms'
import * as s3 from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'
import type { InfrastructureConfig } from './config'

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
  }
}
