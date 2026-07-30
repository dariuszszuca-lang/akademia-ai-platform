import { describe, expect, it, vi } from 'vitest'
import type { SyntheticCleanupRegistry } from '../synthetic-acceptance/cleanup-registry'
import {
  finalizeCurrentReleaseBrowserRun,
  projectBrowserRegistryUpdate,
} from '../../../e2e/current-release/orchestrator'

const runId = 'syn-20260729T220000Z-deadbeef'
const subjectA = '11111111-1111-4111-8111-111111111111'
const subjectB = '22222222-2222-4222-8222-222222222222'
const organizationId = '33333333-3333-4333-8333-333333333333'
const projectId = '44444444-4444-4444-8444-444444444444'
const factId = '55555555-5555-4555-8555-555555555555'
const sourceId = '66666666-6666-4666-8666-666666666666'
const jobId = '77777777-7777-4777-8777-777777777777'
const proposalId = '88888888-8888-4888-8888-888888888888'

function registry(): SyntheticCleanupRegistry {
  return {
    runId,
    username: `synthetic-acceptance-${runId}@example.invalid`,
    cognitoSub: null,
    organizationId,
    organizationPrefix:
      `originals/organizations/${organizationId}/`,
    projectIds: [projectId],
    factIds: [factId],
    sourceJobIds: [jobId],
    proposalIds: [proposalId],
    sourceIds: [sourceId],
    storageKeys: [
      `originals/organizations/${organizationId}/sources/${sourceId}.pdf`,
    ],
    releaseUsers: [
      {
        role: 'a',
        username:
          `synthetic-release-${runId}-a@example.invalid`,
        cognitoSub: subjectA,
      },
      {
        role: 'b',
        username:
          `synthetic-release-${runId}-b@example.invalid`,
        cognitoSub: subjectB,
      },
    ],
    kvKeys: [
      `user:${subjectA}:profil`,
      `user:${subjectB}:profil`,
    ],
    adminAgentState: {
      agentId: 'publikacja',
      enabled: true,
    },
    accountDeletionReceipts: [
      {
        role: 'a',
        ok: true,
        sourceObjects: 1,
        propertyStudio: 1,
        accountKeys: 5,
      },
    ],
    ephemeralStateExpiresAt: 1_785_362_465,
    startedAt: '2026-07-29T22:00:00.000Z',
  }
}

describe('current release browser registry projection', () => {
  it('projects only the strict browser-owned cleanup evidence', () => {
    const update = projectBrowserRegistryUpdate(registry())

    expect(update).toEqual({
      releaseUsers: registry().releaseUsers,
      organizationId,
      organizationPrefix:
        `originals/organizations/${organizationId}/`,
      projectIds: [projectId],
      factIds: [factId],
      sourceJobIds: [jobId],
      proposalIds: [proposalId],
      sourceIds: [sourceId],
      storageKeys: [
        `originals/organizations/${organizationId}/sources/${sourceId}.pdf`,
      ],
      kvKeys: [
        `user:${subjectA}:profil`,
        `user:${subjectB}:profil`,
      ],
      adminAgentState: {
        agentId: 'publikacja',
        enabled: true,
      },
      accountDeletionReceipts:
        registry().accountDeletionReceipts,
      ephemeralStateExpiresAt: 1_785_362_465,
    })
    expect(update).not.toHaveProperty('runId')
    expect(update).not.toHaveProperty('username')
    expect(update).not.toHaveProperty('startedAt')
  })
})

describe('current release browser finalization', () => {
  it('closes B and A independently before reading and writing the result', async () => {
    const order: string[] = []
    const writeResult = vi.fn(async () => {
      order.push('write')
    })
    const forbiddenValues = [
      'password-a',
      'password-b',
      'admin-password',
      'acceptance-secret',
    ] as const

    await finalizeCurrentReleaseBrowserRun({
      contextB: {
        close: async () => {
          order.push('close-b')
        },
      },
      contextA: {
        close: async () => {
          order.push('close-a')
        },
      },
      primaryError: null,
      scenarios: () => [
        {
          name: 'auth.registration',
          status: 'passed',
          durationMs: 1,
        },
      ],
      modelIds: new Set(['claude-haiku-4-5-20251001']),
      usage: {
        onboardingGenerationCalls: 9,
        agentCalls: 8,
        sourcePipelineCalls: 1,
        observedPipelineCostUsd: 0.12,
      },
      readJournal: async () => {
        order.push('read')
        return registry()
      },
      writeResult,
      forbiddenValues,
    })

    expect(order).toEqual([
      'close-b',
      'close-a',
      'read',
      'write',
    ])
    expect(writeResult).toHaveBeenCalledTimes(1)
    expect(writeResult).toHaveBeenCalledWith(
      {
        scenarios: [
          {
            name: 'auth.registration',
            status: 'passed',
            durationMs: 1,
          },
        ],
        modelIds: ['claude-haiku-4-5-20251001'],
        usage: {
          onboardingGenerationCalls: 9,
          agentCalls: 8,
          sourcePipelineCalls: 1,
          observedPipelineCostUsd: 0.12,
        },
        registryUpdate: projectBrowserRegistryUpdate(registry()),
      },
      forbiddenValues,
    )
  })

  it('attempts A when B close fails and never writes a result', async () => {
    const closeA = vi.fn(async () => {})
    const readJournal = vi.fn(async () => registry())
    const writeResult = vi.fn(async () => {})

    await expect(
      finalizeCurrentReleaseBrowserRun({
        contextB: {
          close: async () => {
            throw new Error('provider detail')
          },
        },
        contextA: { close: closeA },
        primaryError: null,
        scenarios: () => [],
        modelIds: new Set(),
        usage: {
          onboardingGenerationCalls: 0,
          agentCalls: 0,
          sourcePipelineCalls: 0,
          observedPipelineCostUsd: 0,
        },
        readJournal,
        writeResult,
        forbiddenValues: [],
      }),
    ).rejects.toThrow('CURRENT_RELEASE_CONTEXT_CLOSE_FAILED')

    expect(closeA).toHaveBeenCalledTimes(1)
    expect(readJournal).not.toHaveBeenCalled()
    expect(writeResult).not.toHaveBeenCalled()
  })

  it('writes the rejected partial result before rethrowing the scenario error', async () => {
    const scenarioError = new Error('STUDIO_SOURCE_FAILED')
    const writeResult = vi.fn(async () => {})

    await expect(
      finalizeCurrentReleaseBrowserRun({
        primaryError: scenarioError,
        scenarios: () => [
          {
            name: 'studio.source',
            status: 'failed',
            durationMs: 10,
            errorCode: 'STUDIO_SOURCE_FAILED',
          },
        ],
        modelIds: new Set(),
        usage: {
          onboardingGenerationCalls: 9,
          agentCalls: 8,
          sourcePipelineCalls: 1,
          observedPipelineCostUsd: 0,
        },
        readJournal: async () => registry(),
        writeResult,
        forbiddenValues: [],
      }),
    ).rejects.toBe(scenarioError)

    expect(writeResult).toHaveBeenCalledTimes(1)
  })

  it('uses a stable combined error when a scenario and context close fail', async () => {
    const writeResult = vi.fn(async () => {})

    await expect(
      finalizeCurrentReleaseBrowserRun({
        contextA: {
          close: async () => {
            throw new Error('sensitive close detail')
          },
        },
        primaryError: new Error('AUTH_SESSION_FAILED'),
        scenarios: () => [],
        modelIds: new Set(),
        usage: {
          onboardingGenerationCalls: 0,
          agentCalls: 0,
          sourcePipelineCalls: 0,
          observedPipelineCostUsd: 0,
        },
        readJournal: async () => registry(),
        writeResult,
        forbiddenValues: [],
      }),
    ).rejects.toThrow(
      'CURRENT_RELEASE_SCENARIO_AND_CONTEXT_CLOSE_FAILED',
    )

    expect(writeResult).not.toHaveBeenCalled()
  })
})
