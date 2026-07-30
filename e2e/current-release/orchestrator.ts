import {
  browserRegistryUpdateSchema,
  type BrowserExecutionResult,
  type BrowserRegistryUpdate,
} from '../../src/features/current-release-acceptance/browser-result'
import type { ScenarioResult } from '../../src/features/current-release-acceptance/domain'
import type { SyntheticCleanupRegistry } from '../../src/features/synthetic-acceptance/cleanup-registry'

type CloseableContext = {
  close(): Promise<void>
}

type BrowserUsage = BrowserExecutionResult['usage']

type FinalizeCurrentReleaseBrowserRunInput = {
  contextB?: CloseableContext
  contextA?: CloseableContext
  primaryError: unknown | null
  scenarios(): ScenarioResult[]
  modelIds: ReadonlySet<string>
  usage: BrowserUsage
  readJournal(): Promise<SyntheticCleanupRegistry>
  writeResult(
    result: BrowserExecutionResult,
    forbiddenValues: readonly string[],
  ): Promise<void>
  forbiddenValues: readonly string[]
}

type CurrentReleaseScenarioFlowInput<Handoff, Studio, Usage> = {
  runAuthOnboarding(): Promise<Handoff>
  runAgents(handoff: Handoff): Promise<void>
  runStudio(handoff: Handoff): Promise<Studio>
  runAdminAccountMobile(
    handoff: Handoff,
    studio: Studio,
  ): Promise<Usage>
}

export async function runCurrentReleaseScenarioFlow<
  Handoff,
  Studio,
  Usage,
>(
  input: CurrentReleaseScenarioFlowInput<Handoff, Studio, Usage>,
): Promise<Usage> {
  const handoff = await input.runAuthOnboarding()
  await input.runAgents(handoff)
  const studio = await input.runStudio(handoff)
  return input.runAdminAccountMobile(handoff, studio)
}

export function projectBrowserRegistryUpdate(
  registry: SyntheticCleanupRegistry,
): BrowserRegistryUpdate {
  return browserRegistryUpdateSchema.parse({
    releaseUsers: registry.releaseUsers,
    organizationId: registry.organizationId,
    organizationPrefix: registry.organizationPrefix,
    projectIds: registry.projectIds,
    factIds: registry.factIds,
    sourceJobIds: registry.sourceJobIds,
    proposalIds: registry.proposalIds,
    sourceIds: registry.sourceIds,
    storageKeys: registry.storageKeys,
    kvKeys: registry.kvKeys,
    adminAgentState: registry.adminAgentState,
    accountDeletionReceipts: registry.accountDeletionReceipts,
    ephemeralStateExpiresAt: registry.ephemeralStateExpiresAt,
  })
}

export async function finalizeCurrentReleaseBrowserRun(
  input: FinalizeCurrentReleaseBrowserRunInput,
): Promise<void> {
  const closeFailed = await closeBrowserContexts(
    input.contextB,
    input.contextA,
  )
  if (closeFailed) {
    throw new Error(
      input.primaryError
        ? 'CURRENT_RELEASE_SCENARIO_AND_CONTEXT_CLOSE_FAILED'
        : 'CURRENT_RELEASE_CONTEXT_CLOSE_FAILED',
    )
  }
  if (
    input.usage.sourcePipelineCalls === 1 &&
    input.usage.observedPipelineCostUsd <= 0
  ) {
    throw new Error('CURRENT_RELEASE_PIPELINE_COST_NOT_OBSERVED')
  }

  let finalizationFailed = false
  try {
    const registry = await input.readJournal()
    await input.writeResult(
      {
        scenarios: input.scenarios(),
        modelIds: [...input.modelIds].sort(),
        usage: input.usage,
        registryUpdate: projectBrowserRegistryUpdate(registry),
      },
      input.forbiddenValues,
    )
  } catch {
    finalizationFailed = true
  }

  if (finalizationFailed) {
    throw new Error(
      input.primaryError
        ? 'CURRENT_RELEASE_SCENARIO_AND_RESULT_FINALIZATION_FAILED'
        : 'CURRENT_RELEASE_RESULT_FINALIZATION_FAILED',
    )
  }
  if (input.primaryError) throw input.primaryError
}

async function closeBrowserContexts(
  contextB: CloseableContext | undefined,
  contextA: CloseableContext | undefined,
): Promise<boolean> {
  let failed = false
  for (const context of [contextB, contextA]) {
    if (!context) continue
    try {
      await context.close()
    } catch {
      failed = true
    }
  }
  return failed
}
