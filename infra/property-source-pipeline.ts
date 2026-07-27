import {
  CfnOutput,
  Duration,
  RemovalPolicy,
} from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as kms from 'aws-cdk-lib/aws-kms'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as sfn from 'aws-cdk-lib/aws-stepfunctions'
import { Construct } from 'constructs'
import type { InfrastructureConfig } from './config'

type PropertySourcePipelineProps = {
  bucket: s3.IBucket
  encryptionKey: kms.IKey
  config: InfrastructureConfig
}

export class PropertySourcePipeline extends Construct {
  readonly stateMachineArn: string
  readonly callbackSecretArn: string

  constructor(
    scope: Construct,
    id: string,
    props: PropertySourcePipelineProps,
  ) {
    super(scope, id)

    const { bucket, config } = props
    const retention =
      config.studioEnv === 'prod'
        ? logs.RetentionDays.TWO_WEEKS
        : logs.RetentionDays.THREE_DAYS

    const foundationLogGroup = createLogGroup(
      this,
      'FoundationWorkerLogs',
      `/aws/lambda/property-source-pipeline-${config.studioEnv}-foundation`,
      retention,
    )
    const foundationRole = createLambdaRole(
      this,
      'FoundationWorkerRole',
      foundationLogGroup,
    )
    const foundationWorker = new lambda.Function(
      this,
      'FoundationWorker',
      {
        functionName:
          `property-source-pipeline-${config.studioEnv}-foundation`,
        runtime: lambda.Runtime.NODEJS_24_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline(FOUNDATION_WORKER_CODE),
        role: foundationRole,
        logGroup: foundationLogGroup,
        memorySize: 256,
        timeout: Duration.seconds(10),
        reservedConcurrentExecutions: 5,
        environment: {
          PIPELINE_VERSION: config.pipelineVersion,
          STUDIO_CALLBACK_BASE_URL: config.studioCallbackBaseUrl,
        },
      },
    )
    const foundationAlias = new lambda.Alias(
      this,
      'FoundationWorkerAlias',
      {
        aliasName: config.studioEnv,
        version: foundationWorker.currentVersion,
      },
    )

    const stateMachineRole = new iam.Role(
      this,
      'StateMachineRole',
      {
        assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
        description:
          'Invokes only Property Intelligence Studio pipeline workers',
      },
    )
    stateMachineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [foundationAlias.functionArn],
      }),
    )
    const stateMachine = new sfn.CfnStateMachine(
      this,
      'StateMachine',
      {
        roleArn: stateMachineRole.roleArn,
        stateMachineName:
          `property-source-pipeline-${config.studioEnv}`,
        stateMachineType: 'STANDARD',
        definitionString: JSON.stringify({
          Comment:
            'Property source extraction pipeline foundation',
          StartAt: 'FoundationWorker',
          TimeoutSeconds: 1800,
          States: {
            FoundationWorker: {
              Type: 'Task',
              Resource: '${FoundationWorkerArn}',
              Retry: [
                {
                  ErrorEquals: [
                    'Lambda.ServiceException',
                    'Lambda.AWSLambdaException',
                    'Lambda.SdkClientException',
                  ],
                  IntervalSeconds: 2,
                  BackoffRate: 2,
                  MaxAttempts: 2,
                },
              ],
              Catch: [
                {
                  ErrorEquals: ['States.ALL'],
                  ResultPath: '$.technicalError',
                  Next: 'PipelineFailed',
                },
              ],
              Next: 'PipelineSucceeded',
            },
            PipelineSucceeded: {
              Type: 'Succeed',
            },
            PipelineFailed: {
              Type: 'Fail',
              Error: 'PROPERTY_SOURCE_PIPELINE_FAILED',
              Cause: 'A bounded pipeline step failed.',
            },
          },
        }),
        definitionSubstitutions: {
          FoundationWorkerArn: foundationAlias.functionArn,
        },
      },
    )
    stateMachine.node.addDependency(stateMachineRole)
    this.stateMachineArn = stateMachine.attrArn

    const starterLogGroup = createLogGroup(
      this,
      'StarterLogs',
      `/aws/lambda/property-source-pipeline-${config.studioEnv}-starter`,
      retention,
    )
    const starterRole = createLambdaRole(
      this,
      'StarterRole',
      starterLogGroup,
    )
    starterRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['states:StartExecution'],
        resources: [stateMachine.attrArn],
      }),
    )
    const starter = new lambda.Function(this, 'Starter', {
      functionName:
        `property-source-pipeline-${config.studioEnv}-starter`,
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(STARTER_CODE),
      role: starterRole,
      logGroup: starterLogGroup,
      memorySize: 256,
      timeout: Duration.seconds(10),
      reservedConcurrentExecutions: 5,
      environment: {
        SELECTED_BUCKET: bucket.bucketName,
        SELECTED_PREFIX: 'originals/',
        PIPELINE_VERSION: config.pipelineVersion,
        STATE_MACHINE_ARN: stateMachine.attrArn,
      },
    })
    const starterAlias = new lambda.Alias(this, 'StarterAlias', {
      aliasName: config.studioEnv,
      version: starter.currentVersion,
    })

    const deadLetterQueue = new sqs.Queue(this, 'EventDeadLetterQueue', {
      queueName:
        `property-source-pipeline-${config.studioEnv}-events-dlq`,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      retentionPeriod: Duration.days(14),
      removalPolicy: RemovalPolicy.RETAIN,
    })
    const scanRule = new events.Rule(this, 'GuardDutyScanRule', {
      ruleName:
        `property-source-pipeline-${config.studioEnv}-guardduty`,
      enabled: true,
      eventPattern: {
        source: ['aws.guardduty'],
        detailType: [
          'GuardDuty Malware Protection Object Scan Result',
        ],
        detail: {
          resourceType: ['S3_OBJECT'],
          s3ObjectDetails: {
            bucketName: [bucket.bucketName],
            objectKey: [{ prefix: 'originals/' }],
          },
        },
      },
    })
    scanRule.addTarget(
      new targets.LambdaFunction(starterAlias, {
        deadLetterQueue,
        maxEventAge: Duration.hours(1),
        retryAttempts: 2,
      }),
    )

    const callbackSecret = config.callbackSecretArn
      ? secretsmanager.Secret.fromSecretCompleteArn(
          this,
          'ImportedCallbackSecret',
          config.callbackSecretArn,
        )
      : new secretsmanager.Secret(this, 'CallbackSecret', {
          secretName:
            `property-studio/${config.studioEnv}/source-callback`,
          description:
            'HMAC secret for Property Intelligence Studio pipeline callbacks',
          generateSecretString: {
            excludePunctuation: true,
            passwordLength: 64,
          },
        })
    if (callbackSecret instanceof secretsmanager.Secret) {
      callbackSecret.applyRemovalPolicy(RemovalPolicy.RETAIN)
    }
    this.callbackSecretArn = callbackSecret.secretArn

    const starterErrors = starterAlias.metricErrors({
      period: Duration.minutes(5),
      statistic: 'sum',
    })
    const failedExecutions = stateMachineMetric(
      'ExecutionsFailed',
      stateMachine.attrArn,
    )
    const timedOutExecutions = stateMachineMetric(
      'ExecutionsTimedOut',
      stateMachine.attrArn,
    )
    const dlqMessages = deadLetterQueue.metricApproximateNumberOfMessagesVisible({
      period: Duration.minutes(5),
      statistic: 'max',
    })

    createAlarm(this, 'StarterErrorsAlarm', starterErrors)
    createAlarm(this, 'FailedExecutionsAlarm', failedExecutions)
    createAlarm(this, 'TimedOutExecutionsAlarm', timedOutExecutions)
    createAlarm(this, 'DeadLetterQueueAlarm', dlqMessages)

    const dashboard = new cloudwatch.Dashboard(
      this,
      'OperationsDashboard',
      {
        dashboardName:
          `property-source-pipeline-${config.studioEnv}`,
      },
    )
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Pipeline failures',
        left: [
          starterErrors,
          failedExecutions,
          timedOutExecutions,
          dlqMessages,
        ],
      }),
    )

    const stateMachineOutput = new CfnOutput(this, 'StateMachineArn', {
      description: 'Property source pipeline state machine ARN',
      value: stateMachine.attrArn,
    })
    stateMachineOutput.overrideLogicalId(
      'PropertySourcePipelineStateMachineArn',
    )
    const callbackSecretOutput = new CfnOutput(
      this,
      'CallbackSecretArn',
      {
        description: 'Property source callback secret ARN',
        value: callbackSecret.secretArn,
      },
    )
    callbackSecretOutput.overrideLogicalId(
      'PropertySourceCallbackSecretArn',
    )
    const pipelineVersionOutput = new CfnOutput(
      this,
      'PipelineVersion',
      {
        description: 'Property source pipeline version',
        value: config.pipelineVersion,
      },
    )
    pipelineVersionOutput.overrideLogicalId(
      'PropertySourcePipelineVersion',
    )
  }
}

function createLogGroup(
  scope: Construct,
  id: string,
  logGroupName: string,
  retention: logs.RetentionDays,
) {
  const logGroup = new logs.LogGroup(scope, id, {
    logGroupName,
    retention,
    removalPolicy: RemovalPolicy.RETAIN,
  })
  return logGroup
}

function createLambdaRole(
  scope: Construct,
  id: string,
  logGroup: logs.ILogGroup,
) {
  const role = new iam.Role(scope, id, {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  })
  role.addToPolicy(
    new iam.PolicyStatement({
      actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [
        logGroup.logGroupArn,
        `${logGroup.logGroupArn}:*`,
      ],
    }),
  )
  return role
}

function stateMachineMetric(
  metricName: string,
  stateMachineArn: string,
) {
  return new cloudwatch.Metric({
    namespace: 'AWS/States',
    metricName,
    dimensionsMap: { StateMachineArn: stateMachineArn },
    period: Duration.minutes(5),
    statistic: 'sum',
  })
}

function createAlarm(
  scope: Construct,
  id: string,
  metric: cloudwatch.IMetric,
) {
  new cloudwatch.Alarm(scope, id, {
    metric,
    threshold: 1,
    evaluationPeriods: 1,
    datapointsToAlarm: 1,
    comparisonOperator:
      cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  })
}

const FOUNDATION_WORKER_CODE = `
'use strict'
exports.handler = async function handler(event) {
  return {
    pipelineVersion: process.env.PIPELINE_VERSION,
    sourceId: event && event.sourceId,
    foundationAccepted: true
  }
}
`

const STARTER_CODE = `
'use strict'
const crypto = require('node:crypto')
const {
  SFNClient,
  StartExecutionCommand
} = require('@aws-sdk/client-sfn')
const client = new SFNClient({})
const keyPattern = /^originals\\\\/organizations\\\\/([^/]+)\\\\/properties\\\\/([^/]+)\\\\/sources\\\\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\\\\/original$/

exports.handler = async function handler(event) {
  const detail = event && event.detail
  const object = detail && detail.s3ObjectDetails
  const result =
    detail && detail.scanResultDetails &&
    detail.scanResultDetails.scanResultStatus
  if (
    !object ||
    object.bucketName !== process.env.SELECTED_BUCKET ||
    !object.objectKey.startsWith(process.env.SELECTED_PREFIX)
  ) {
    throw new Error('UNEXPECTED_SCAN_TARGET')
  }
  const match = keyPattern.exec(object.objectKey)
  if (!match) throw new Error('UNEXPECTED_SCAN_OBJECT_KEY')
  if (result !== 'NO_THREATS_FOUND') {
    return { action: 'do_not_process', scanResultStatus: result }
  }

  const identity = [
    object.bucketName,
    object.objectKey,
    object.versionId,
    result
  ].join('\\\\n')
  const name =
    'source-' +
    crypto.createHash('sha256').update(identity).digest('hex')
  const input = {
    sourceId: match[3],
    bucketName: object.bucketName,
    objectKey: object.objectKey,
    versionId: object.versionId,
    scanResultStatus: result,
    pipelineVersion: process.env.PIPELINE_VERSION
  }
  await client.send(new StartExecutionCommand({
    stateMachineArn: process.env.STATE_MACHINE_ARN,
    name,
    input: JSON.stringify(input)
  }))
  return { action: 'started', executionName: name }
}
`
