import { test } from '@playwright/test'
import { createChildCostBudget } from './budget'
import { parseCurrentReleaseFixtures } from './fixtures'
import { createCurrentReleaseJournal } from './journal'
import {
  resolveOperatorContext,
  type OperatorBaseContext,
} from './operator'
import { createCurrentReleaseScenarioRecorder } from './result'
import {
  runAuthOnboardingScenarios,
  type Task8BrowserLifecycle,
} from './scenarios/auth-onboarding'
import { runAgentScenarios } from './scenarios/agents'
import { createScenarioRunner } from './ui-helpers'
import { createTask8NetworkLedger } from './ui-helpers'

test.describe.serial(
  'Property Intelligence Studio — current release acceptance',
  () => {
    const lifecycle: Task8BrowserLifecycle = {}

    test.afterAll(async () => {
      await lifecycle.contextB?.close()
      await lifecycle.contextA?.close()
    })

    test('authenticates, onboards and exercises all six agents', async ({
      browser,
    }) => {
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

      const handoff = await runAuthOnboardingScenarios({
        browser,
        fixtures,
        operatorContext,
        budget,
        journal,
        modelIds,
        runScenario,
        lifecycle,
        networkLedger,
      })
      await runAgentScenarios(handoff)

      // Task 9 extends this exact serial flow with Studio, admin, account
      // deletion and mobile scenarios, then owns the single atomic result
      // write. Until then this module intentionally keeps all state only in
      // memory and never claims a complete production acceptance result.
    })
  },
)
