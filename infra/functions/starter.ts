import {
  SFNClient,
  StartExecutionCommand,
  type StartExecutionCommandInput,
  type StartExecutionCommandOutput,
} from '@aws-sdk/client-sfn'
import { z } from 'zod'
import {
  routeGuardDutyObjectScan,
  type GuardDutyObjectScanEvent,
} from '../../src/features/property-sources/pipeline/guardduty-event'

const starterEnvironmentSchema = z
  .object({
    pipelineVersion: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/),
    selectedBucket: z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
    stateMachineArn: z
      .string()
      .regex(
        /^arn:aws:states:eu-central-1:\d{12}:stateMachine:[A-Za-z0-9_-]{1,80}$/,
      ),
  })
  .strict()

type StarterEnvironment = z.infer<typeof starterEnvironmentSchema>

type StarterDependencies = {
  environment: StarterEnvironment
  startExecution: (
    input: StartExecutionCommandInput,
  ) => Promise<StartExecutionCommandOutput>
}

export function createStarterHandler({
  environment: rawEnvironment,
  startExecution,
}: StarterDependencies) {
  const parsed = starterEnvironmentSchema.safeParse(rawEnvironment)
  if (!parsed.success) throw new Error('INVALID_STARTER_CONFIGURATION')
  const environment = parsed.data

  return async (rawEvent: unknown) => {
    const route = routeGuardDutyObjectScan(
      rawEvent,
      environment.selectedBucket,
    )
    if (route.action === 'do_not_process') return route

    const input = {
      sourceId: route.sourceId,
      bucketName: route.bucketName,
      objectKey: route.objectKey,
      versionId: route.versionId,
      scanResultStatus: route.scanResultStatus,
      executionName: route.executionName,
      idempotencyKey: route.executionName,
      attempt: 1,
      pipelineVersion: environment.pipelineVersion,
    }
    try {
      const execution = await startExecution({
        stateMachineArn: environment.stateMachineArn,
        name: route.executionName,
        input: JSON.stringify(input),
      })
      return {
        action: 'started' as const,
        executionName: route.executionName,
        executionArn: execution.executionArn,
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'ExecutionAlreadyExists'
      ) {
        return {
          action: 'already_started' as const,
          executionName: route.executionName,
        }
      }
      throw error
    }
  }
}

let defaultHandler:
  | ReturnType<typeof createStarterHandler>
  | undefined

export async function handler(event: GuardDutyObjectScanEvent) {
  defaultHandler ??= createStarterHandler({
    environment: {
      pipelineVersion: process.env.PIPELINE_VERSION ?? '',
      selectedBucket: process.env.SELECTED_BUCKET ?? '',
      stateMachineArn: process.env.STATE_MACHINE_ARN ?? '',
    },
    startExecution: (input) =>
      new SFNClient({}).send(new StartExecutionCommand(input)),
  })
  return defaultHandler(event)
}
