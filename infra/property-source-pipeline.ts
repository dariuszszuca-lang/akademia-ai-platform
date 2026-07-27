import path from 'node:path'
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
} from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as kms from 'aws-cdk-lib/aws-kms'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs'
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

type WorkerProps = {
  entry: string
  environment?: Record<string, string>
  memorySize?: number
  timeoutSeconds?: number
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

    const { bucket, config, encryptionKey } = props
    const retention =
      config.studioEnv === 'prod'
        ? logs.RetentionDays.TWO_WEEKS
        : logs.RetentionDays.THREE_DAYS

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

    const callback = createWorker(
      this,
      'Callback',
      config,
      retention,
      {
        entry: 'callback-sender',
        environment: {
          CALLBACK_SECRET_ARN: callbackSecret.secretArn,
          STUDIO_CALLBACK_BASE_URL: config.studioCallbackBaseUrl,
        },
        timeoutSeconds: 15,
      },
    )
    callback.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [callbackSecret.secretArn],
      }),
    )

    const validator = createWorker(
      this,
      'Validator',
      config,
      retention,
      {
        entry: 'validator',
        memorySize: 512,
        timeoutSeconds: 30,
      },
    )
    validator.role.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          's3:GetObject',
          's3:GetObjectVersion',
          's3:GetObjectTagging',
          's3:GetObjectVersionTagging',
        ],
        resources: [bucket.arnForObjects('originals/*')],
      }),
    )
    validator.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject'],
        resources: [bucket.arnForObjects('work/*')],
      }),
    )
    addS3KmsDecryptPermission(
      validator.role,
      encryptionKey,
      config.region,
      true,
    )

    const evidence = createWorker(
      this,
      'Evidence',
      config,
      retention,
      {
        entry: 'bedrock-evidence',
        environment: {
          BEDROCK_MODEL_ID: config.bedrockModelId,
        },
        memorySize: 512,
        timeoutSeconds: 90,
      },
    )
    evidence.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:GetObjectVersion'],
        resources: [
          bucket.arnForObjects('originals/*'),
          bucket.arnForObjects('work/*'),
          bucket.arnForObjects('transcripts/*'),
        ],
      }),
    )
    addS3KmsDecryptPermission(
      evidence.role,
      encryptionKey,
      config.region,
    )
    addBedrockPermissions(evidence.role, config)

    const proposals = createWorker(
      this,
      'Proposals',
      config,
      retention,
      {
        entry: 'bedrock-proposals',
        environment: {
          BEDROCK_MODEL_ID: config.bedrockModelId,
        },
        memorySize: 512,
        timeoutSeconds: 90,
      },
    )
    addBedrockPermissions(proposals.role, config)

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
        resources: [
          callback.alias.functionArn,
          validator.alias.functionArn,
          evidence.alias.functionArn,
          proposals.alias.functionArn,
        ],
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
        definitionString: JSON.stringify(
          createStateMachineDefinition(),
        ),
        definitionSubstitutions: {
          CallbackWorkerArn: callback.alias.functionArn,
          ValidatorWorkerArn: validator.alias.functionArn,
          EvidenceWorkerArn: evidence.alias.functionArn,
          ProposalWorkerArn: proposals.alias.functionArn,
        },
      },
    )
    stateMachine.node.addDependency(stateMachineRole)
    this.stateMachineArn = stateMachine.attrArn

    const starter = createWorker(
      this,
      'Starter',
      config,
      retention,
      {
        entry: 'starter',
        environment: {
          SELECTED_BUCKET: bucket.bucketName,
          PIPELINE_VERSION: config.pipelineVersion,
          STATE_MACHINE_ARN: stateMachine.attrArn,
        },
        timeoutSeconds: 10,
      },
    )
    starter.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['states:StartExecution'],
        resources: [stateMachine.attrArn],
      }),
    )

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
      new targets.LambdaFunction(starter.alias, {
        deadLetterQueue,
        maxEventAge: Duration.hours(1),
        retryAttempts: 2,
      }),
    )

    const starterErrors = starter.alias.metricErrors({
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
    const dlqMessages =
      deadLetterQueue.metricApproximateNumberOfMessagesVisible({
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

function createWorker(
  scope: Construct,
  logicalName: string,
  config: InfrastructureConfig,
  retention: logs.RetentionDays,
  props: WorkerProps,
) {
  const workerName = props.entry
    .replace('bedrock-', '')
    .replace('-sender', '')
  const functionName =
    `property-source-pipeline-${config.studioEnv}-${workerName}`
  const logGroup = createLogGroup(
    scope,
    `${logicalName}Logs`,
    `/aws/lambda/${functionName}`,
    retention,
  )
  const role = createLambdaRole(
    scope,
    `${logicalName}Role`,
    logGroup,
  )
  const fn = new lambdaNodejs.NodejsFunction(
    scope,
    `${logicalName}Worker`,
    {
      functionName,
      entry: path.join(
        __dirname,
        'functions',
        `${props.entry}.ts`,
      ),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.X86_64,
      role,
      logGroup,
      memorySize: props.memorySize ?? 256,
      timeout: Duration.seconds(props.timeoutSeconds ?? 30),
      reservedConcurrentExecutions: 5,
      environment: props.environment,
      depsLockFilePath: path.join(__dirname, '..', 'package-lock.json'),
      bundling: {
        bundleAwsSDK: true,
        minify: true,
        nodeModules:
          props.entry === 'validator' ? ['sharp'] : undefined,
        environment:
          props.entry === 'validator'
            ? {
                npm_config_cpu: 'x64',
                npm_config_include: 'optional',
                npm_config_libc: 'glibc',
                npm_config_os: 'linux',
              }
            : undefined,
        sourceMap: false,
        target: 'node24',
      },
    },
  )
  const alias = new lambda.Alias(
    scope,
    `${logicalName}WorkerAlias`,
    {
      aliasName: config.studioEnv,
      version: fn.currentVersion,
    },
  )
  return { fn, alias, role }
}

function addS3KmsDecryptPermission(
  role: iam.Role,
  key: kms.IKey,
  region: string,
  allowWrite = false,
) {
  role.addToPolicy(
    new iam.PolicyStatement({
      actions: allowWrite
        ? ['kms:Decrypt', 'kms:GenerateDataKey']
        : ['kms:Decrypt'],
      resources: [key.keyArn],
      conditions: {
        StringEquals: {
          'kms:ViaService': `s3.${region}.amazonaws.com`,
        },
      },
    }),
  )
}

function addBedrockPermissions(
  role: iam.Role,
  config: InfrastructureConfig,
) {
  const stack = Stack.of(role)
  const foundationModelId = config.bedrockModelId.replace(
    /^eu\./,
    '',
  )
  const inferenceProfileArn = stack.formatArn({
    service: 'bedrock',
    resource: 'inference-profile',
    resourceName: config.bedrockModelId,
  })
  const destinationRegions = [
    'eu-central-1',
    'eu-north-1',
    'eu-south-1',
    'eu-south-2',
    'eu-west-1',
    'eu-west-3',
  ]

  role.addToPolicy(
    new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [inferenceProfileArn],
    }),
  )
  role.addToPolicy(
    new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: destinationRegions.map((region) =>
        stack.formatArn({
          service: 'bedrock',
          region,
          account: '',
          resource: 'foundation-model',
          resourceName: foundationModelId,
        }),
      ),
      conditions: {
        StringEquals: {
          'bedrock:InferenceProfileArn': inferenceProfileArn,
        },
      },
    }),
  )
}

function createStateMachineDefinition() {
  const retry = [
    {
      ErrorEquals: ['States.TaskFailed'],
      IntervalSeconds: 2,
      BackoffRate: 2,
      MaxAttempts: 2,
    },
  ]
  const catchFailure = [
    {
      ErrorEquals: ['States.ALL'],
      ResultPath: '$.technicalError',
      Next: 'PipelineFailed',
    },
  ]
  const catchTechnicalFailure = [
    {
      ErrorEquals: ['States.ALL'],
      ResultPath: '$.technicalError',
      Next: 'TechnicalFailureResult',
    },
  ]
  return {
    Comment: 'Property Intelligence Studio source extraction',
    StartAt: 'CallbackContext',
    TimeoutSeconds: 1800,
    States: {
      CallbackContext: {
        Type: 'Task',
        Resource: '${CallbackWorkerArn}',
        Parameters: {
          action: 'context',
          payload: {
            'sourceId.$': '$.sourceId',
            'idempotencyKey.$': '$.idempotencyKey',
            'attempt.$': '$.attempt',
            'pipelineVersion.$': '$.pipelineVersion',
          },
          'sourceId.$': '$.sourceId',
          'bucketName.$': '$.bucketName',
          'objectKey.$': '$.objectKey',
          'versionId.$': '$.versionId',
          'scanResultStatus.$': '$.scanResultStatus',
          'attempt.$': '$.attempt',
          'pipelineVersion.$': '$.pipelineVersion',
        },
        Retry: retry,
        Catch: catchFailure,
        Next: 'ValidateObject',
      },
      ValidateObject: {
        Type: 'Task',
        Resource: '${ValidatorWorkerArn}',
        Retry: retry,
        Catch: catchTechnicalFailure,
        Next: 'ValidationRoute',
      },
      ValidationRoute: {
        Type: 'Choice',
        Choices: [
          {
            Variable: '$.result',
            IsPresent: true,
            Next: 'SubmitResult',
          },
        ],
        Default: 'MapEvidence',
      },
      MapEvidence: {
        Type: 'Task',
        Resource: '${EvidenceWorkerArn}',
        Retry: retry,
        Catch: catchTechnicalFailure,
        Next: 'EvidenceRoute',
      },
      EvidenceRoute: {
        Type: 'Choice',
        Choices: [
          {
            Variable: '$.result',
            IsPresent: true,
            Next: 'SubmitResult',
          },
        ],
        Default: 'BuildProposals',
      },
      BuildProposals: {
        Type: 'Task',
        Resource: '${ProposalWorkerArn}',
        Retry: retry,
        Catch: catchTechnicalFailure,
        Next: 'SubmitResult',
      },
      TechnicalFailureResult: {
        Type: 'Pass',
        Parameters: {
          result: {
            'sourceId.$': '$.sourceId',
            'jobId.$': '$.context.jobId',
            'checksumSha256.$': '$.context.source.checksumSha256',
            'attempt.$': '$.attempt',
            'pipelineVersion.$': '$.pipelineVersion',
            outcome: 'failed',
            errorCode: 'EXTRACTION_FAILED',
          },
        },
        Next: 'SubmitResult',
      },
      SubmitResult: {
        Type: 'Task',
        Resource: '${CallbackWorkerArn}',
        Parameters: {
          action: 'result',
          'payload.$': '$.result',
        },
        Retry: retry,
        Catch: catchFailure,
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
  }
}

function createLogGroup(
  scope: Construct,
  id: string,
  logGroupName: string,
  retention: logs.RetentionDays,
) {
  return new logs.LogGroup(scope, id, {
    logGroupName,
    retention,
    removalPolicy: RemovalPolicy.RETAIN,
  })
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
