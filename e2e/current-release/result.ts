import {
  currentReleaseBrowserScenarioSchema,
  currentReleaseBrowserScenarios,
  type CurrentReleaseBrowserScenario,
} from '../../src/features/current-release-acceptance/browser-result'
import {
  currentReleaseScenarioResultSchema,
  type ScenarioResult,
} from '../../src/features/current-release-acceptance/domain'

export type CurrentReleaseScenarioRecorder = {
  pass(
    name: CurrentReleaseBrowserScenario,
    durationMs: number,
  ): void
  fail(
    name: CurrentReleaseBrowserScenario,
    durationMs: number,
    errorCode: string,
  ): void
  finalize(): ScenarioResult[]
}

export function createCurrentReleaseScenarioRecorder(): CurrentReleaseScenarioRecorder {
  const recorded = new Map<
    CurrentReleaseBrowserScenario,
    ScenarioResult
  >()

  function record(
    name: CurrentReleaseBrowserScenario,
    result: ScenarioResult,
  ): void {
    const parsedName = currentReleaseBrowserScenarioSchema.parse(name)
    if (recorded.has(parsedName)) {
      throw new Error('CURRENT_RELEASE_SCENARIO_DUPLICATE')
    }
    recorded.set(
      parsedName,
      currentReleaseScenarioResultSchema.parse(result),
    )
  }

  return {
    pass(name, durationMs) {
      record(name, {
        name,
        status: 'passed',
        durationMs,
      })
    },

    fail(name, durationMs, errorCode) {
      record(name, {
        name,
        status: 'failed',
        durationMs,
        errorCode,
      })
    },

    finalize() {
      return currentReleaseBrowserScenarios.map(
        (name) =>
          recorded.get(name) ?? {
            name,
            status: 'failed',
            durationMs: 0,
            errorCode: 'CURRENT_RELEASE_SCENARIO_NOT_RUN',
          },
      )
    },
  }
}
