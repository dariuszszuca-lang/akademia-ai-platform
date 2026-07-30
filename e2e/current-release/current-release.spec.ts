import { test } from '@playwright/test'
import { createChildCostBudget } from './budget'
import { parseCurrentReleaseFixtures } from './fixtures'
import {
  createCurrentReleaseJournal,
  readCurrentReleaseJournal,
  writeCurrentReleaseResult,
} from './journal'
import {
  finalizeCurrentReleaseBrowserRun,
  runCurrentReleaseScenarioFlow,
} from './orchestrator'
import {
  resolveOperatorContext,
  type OperatorBaseContext,
} from './operator'
import { createCurrentReleaseScenarioRecorder } from './result'
import { runAdminAccountMobileScenarios } from './scenarios/admin-account-mobile'
import { runAgentScenarios } from './scenarios/agents'
import {
  runAuthOnboardingScenarios,
  type Task8BrowserLifecycle,
} from './scenarios/auth-onboarding'
import { runStudioScenarios } from './scenarios/studio'
import type {
  Task9BrowserUsage,
  Task9Runtime,
} from './task9-helpers'
import {
  createScenarioRunner,
  createTask8NetworkLedger,
} from './ui-helpers'

test.describe.serial(
  'Property Intelligence Studio — current release acceptance',
  () => {
    test('verifies the complete non-payment product release', async ({
      browser,
    }) => {
      test.setTimeout(40 * 60_000)
      const fixtures = parseCurrentReleaseFixtures()
      const operatorBase: OperatorBaseContext = {
        runId: fixtures.runId,
        profile: fixtures.awsProfile,
        region: fixtures.awsRegion,
        accountId: '261965598943',
      }
      const operatorContext =
        await resolveOperatorContext(operatorBase)
      const budget = createChildCostBudget(fixtures.budget)
      const journal = createCurrentReleaseJournal(
        fixtures.paths,
        fixtures.runId,
      )
      const recorder = createCurrentReleaseScenarioRecorder()
      const modelIds = new Set<string>()
      const runScenario = createScenarioRunner(recorder)
      const networkLedger = createTask8NetworkLedger()
      const lifecycle: Task8BrowserLifecycle = {}
      let observedPipelineCostUsd = 0
      let recordedTask9Usage: Task9BrowserUsage | null = null
      let primaryError: unknown | null = null

      try {
        await runCurrentReleaseScenarioFlow({
          runAuthOnboarding: () =>
            runAuthOnboardingScenarios({
              browser,
              fixtures,
              operatorContext,
              budget,
              journal,
              modelIds,
              runScenario,
              lifecycle,
              networkLedger,
            }),
          runAgents: runAgentScenarios,
          runStudio: (handoff) =>
            runStudioScenarios(
              createTask9Runtime({
                handoff,
                journal,
                recordUsage: async (usage) => {
                  if (
                    recordedTask9Usage &&
                    (recordedTask9Usage.observedPipelineCostUsd !==
                      usage.observedPipelineCostUsd ||
                      recordedTask9Usage.modelIds.join('\0') !==
                        usage.modelIds.join('\0'))
                  ) {
                    throw new Error(
                      'CURRENT_RELEASE_TASK9_USAGE_CONFLICT',
                    )
                  }
                  recordedTask9Usage = usage
                  observedPipelineCostUsd =
                    usage.observedPipelineCostUsd
                  for (const modelId of usage.modelIds) {
                    modelIds.add(modelId)
                  }
                },
              }),
            ),
          runAdminAccountMobile: (handoff, studio) =>
            runAdminAccountMobileScenarios(
              createTask9Runtime({
                handoff,
                journal,
                recordUsage: async (usage) => {
                  if (
                    recordedTask9Usage &&
                    (recordedTask9Usage.observedPipelineCostUsd !==
                      usage.observedPipelineCostUsd ||
                      recordedTask9Usage.modelIds.join('\0') !==
                        usage.modelIds.join('\0'))
                  ) {
                    throw new Error(
                      'CURRENT_RELEASE_TASK9_USAGE_CONFLICT',
                    )
                  }
                  recordedTask9Usage = usage
                  observedPipelineCostUsd =
                    usage.observedPipelineCostUsd
                  for (const modelId of usage.modelIds) {
                    modelIds.add(modelId)
                  }
                },
              }),
              studio,
            ),
        })
      } catch (error) {
        primaryError = error
      }

      const usage = budget.snapshot()
      if (
        usage.sourcePipelineCalls !== 0 &&
        usage.sourcePipelineCalls !== 1
      ) {
        primaryError ??= new Error(
          'CURRENT_RELEASE_SOURCE_USAGE_INVALID',
        )
      }

      await finalizeCurrentReleaseBrowserRun({
        contextB: lifecycle.contextB,
        contextA: lifecycle.contextA,
        primaryError,
        scenarios: () => recorder.finalize(),
        modelIds,
        usage: {
          onboardingGenerationCalls:
            usage.onboardingGenerationCalls,
          agentCalls: usage.agentCalls,
          sourcePipelineCalls:
            usage.sourcePipelineCalls === 1 ? 1 : 0,
          observedPipelineCostUsd,
        },
        readJournal: () =>
          readCurrentReleaseJournal(
            fixtures.paths,
            fixtures.runId,
          ),
        writeResult: (result, forbiddenValues) =>
          writeCurrentReleaseResult(
            fixtures.paths,
            fixtures.runId,
            result,
            forbiddenValues,
          ),
        forbiddenValues: [
          fixtures.passwordA,
          fixtures.passwordB,
          fixtures.adminPassword,
          fixtures.acceptanceSecret,
          fixtures.runnerGuard,
        ],
      })
    })
  },
)

function createTask9Runtime(input: {
  handoff: Awaited<
    ReturnType<typeof runAuthOnboardingScenarios>
  >
  journal: ReturnType<typeof createCurrentReleaseJournal>
  recordUsage(
    usage: Task9BrowserUsage,
  ): Promise<void>
}): Task9Runtime {
  return {
    fixtures: input.handoff.fixtures,
    pageA: input.handoff.pageA,
    pageB: input.handoff.pageB,
    contextA: input.handoff.contextA,
    contextB: input.handoff.contextB,
    budget: input.handoff.budget,
    operatorContext: input.handoff.operatorContext,
    runScenario: input.handoff.runScenario,
    recordResources: (resource) =>
      input.journal.recordResources(resource),
    recordFactId: (factId) =>
      input.journal.recordFactId(factId),
    recordAdminPreviousState: (agentId, enabled) => {
      if (agentId !== 'publikacja') {
        throw new Error('CURRENT_RELEASE_ADMIN_AGENT_INVALID')
      }
      return input.journal.recordAdminPreviousState(
        agentId,
        enabled,
      )
    },
    recordDeletionReceipt: (role, receipt) =>
      input.journal.recordDeletionReceipt(role, receipt),
    recordUsage: input.recordUsage,
  }
}
