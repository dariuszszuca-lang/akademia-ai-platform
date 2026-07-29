import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertPlaywrightLaunchAllowed,
  writePlaywrightGuardMarker,
} from '../../../e2e/current-release/guard'
import {
  getCurrentReleasePaths,
  writeCurrentReleaseJournal,
} from '../../../e2e/current-release/journal'
import { createSyntheticCleanupRegistry } from '../synthetic-acceptance/cleanup-registry'

const runId = 'syn-20260729T220000Z-deadbeef'
const productionUrl =
  'https://akademia-ai-platform.vercel.app'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('direct Playwright production guard', () => {
  it('allows local discovery without a production guard', () => {
    expect(() =>
      assertPlaywrightLaunchAllowed({
        CURRENT_RELEASE_BASE_URL: 'http://127.0.0.1:3000',
      }),
    ).not.toThrow()
  })

  it('rejects production before test discovery without the runner-only guard', async () => {
    vi.stubEnv('CURRENT_RELEASE_BASE_URL', productionUrl)

    await expect(import('../../../playwright.config')).rejects.toThrow(
      'CURRENT_RELEASE_PLAYWRIGHT_PRODUCTION_GUARD_INVALID',
    )
  })

  it.each([
    `${productionUrl}/`,
    `${productionUrl}/start`,
    `${productionUrl}?preview=1`,
    `https://user:pass@akademia-ai-platform.vercel.app`,
    `https://AKADEMIA-AI-PLATFORM.VERCEL.APP`,
    `http://akademia-ai-platform.vercel.app`,
  ])('rejects every non-canonical production URL: %s', (baseUrl) => {
    expect(() =>
      assertPlaywrightLaunchAllowed({
        CURRENT_RELEASE_BASE_URL: baseUrl,
      }),
    ).toThrow(
      'CURRENT_RELEASE_PLAYWRIGHT_PRODUCTION_GUARD_INVALID',
    )
  })

  it('accepts the complete runner contract with a matching marker', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'release-guard-'))
    const paths = getCurrentReleasePaths(workspace, runId)
    const registry = createSyntheticCleanupRegistry({
      runId,
      startedAt: '2026-07-29T22:00:00.000Z',
    })
    registry.releaseUsers = [
      {
        role: 'a',
        username: `synthetic-release-${runId}-a@example.invalid`,
        cognitoSub: null,
      },
      {
        role: 'b',
        username: `synthetic-release-${runId}-b@example.invalid`,
        cognitoSub: null,
      },
    ]
    await writeCurrentReleaseJournal(paths, registry)
    const nonce = 'a'.repeat(43)
    await writePlaywrightGuardMarker(paths, runId, nonce)

    expect(() =>
      assertPlaywrightLaunchAllowed({
        CURRENT_RELEASE_BASE_URL: productionUrl,
        CURRENT_RELEASE_RUN_ID: runId,
        CURRENT_RELEASE_WORKSPACE_ROOT: workspace,
        CURRENT_RELEASE_RUNNER_GUARD: nonce,
        CURRENT_RELEASE_GUARD_MARKER_PATH: paths.guardMarkerPath,
        CURRENT_RELEASE_REGISTRY_PATH: paths.registryPath,
        CURRENT_RELEASE_RESULT_PATH: paths.resultPath,
        CURRENT_RELEASE_BUDGET: JSON.stringify({
          maxUsd: 2,
          stopBeforeUsd: 1.5,
          unitCosts: {
            onboardingGenerationUsd: 0.06,
            agentCallUsd: 0.08,
            sourcePipelineUsd: 0.25,
          },
        }),
        CURRENT_RELEASE_USER_A:
          `synthetic-release-${runId}-a@example.invalid`,
        CURRENT_RELEASE_USER_A_PASSWORD:
          'Synthetic-user-A-password-123!',
        CURRENT_RELEASE_USER_B:
          `synthetic-release-${runId}-b@example.invalid`,
        CURRENT_RELEASE_USER_B_PASSWORD:
          'Synthetic-user-B-password-456!',
        ADMIN_PASSWORD: 'Synthetic-admin-password-789!',
        AWS_PROFILE: 'akademia-ai',
        AWS_REGION: 'eu-central-1',
      }),
    ).not.toThrow()
  })
})
