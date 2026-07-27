import { describe, expect, it, vi } from 'vitest'
import { guardDutyScanFixture } from '../../src/features/property-sources/pipeline/guardduty-event.fixtures'
import { createStarterHandler } from './starter'

const environment = {
  pipelineVersion: 'property-source-v1',
  selectedBucket: 'property-studio-dev-sources',
  stateMachineArn:
    'arn:aws:states:eu-central-1:111122223333:stateMachine:property-source-pipeline-dev',
}

describe('property source pipeline starter worker', () => {
  it('starts one deterministic workflow for a clean GuardDuty result', async () => {
    const startExecution = vi.fn().mockResolvedValue({
      executionArn: 'arn:aws:states:eu-central-1:111122223333:execution:test',
    })
    const handler = createStarterHandler({ environment, startExecution })

    const result = await handler(
      guardDutyScanFixture('NO_THREATS_FOUND'),
    )

    expect(result.action).toBe('started')
    expect(startExecution).toHaveBeenCalledOnce()
    expect(startExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        stateMachineArn: environment.stateMachineArn,
        name: expect.stringMatching(/^source-[a-f0-9]{64}$/),
      }),
    )
    const input = JSON.parse(startExecution.mock.calls[0][0].input)
    expect(input).toMatchObject({
      attempt: 1,
      pipelineVersion: environment.pipelineVersion,
      scanResultStatus: 'NO_THREATS_FOUND',
      sourceId: '00000000-0000-4000-8000-000000000003',
    })
    expect(input.idempotencyKey).toMatch(/^source-[a-f0-9]{64}$/)
  })

  it('does not start processing for a non-clean result', async () => {
    const startExecution = vi.fn()
    const handler = createStarterHandler({ environment, startExecution })

    await expect(
      handler(guardDutyScanFixture('THREATS_FOUND')),
    ).resolves.toMatchObject({
      action: 'do_not_process',
      scanResultStatus: 'THREATS_FOUND',
    })
    expect(startExecution).not.toHaveBeenCalled()
  })

  it('treats an existing Standard workflow as an idempotent duplicate', async () => {
    const startExecution = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('duplicate'), {
        name: 'ExecutionAlreadyExists',
      }))
    const handler = createStarterHandler({ environment, startExecution })

    await expect(
      handler(guardDutyScanFixture('NO_THREATS_FOUND')),
    ).resolves.toMatchObject({ action: 'already_started' })
  })

  it('rejects missing or unsafe environment configuration', () => {
    expect(() =>
      createStarterHandler({
        environment: { ...environment, stateMachineArn: '*' },
        startExecution: vi.fn(),
      }),
    ).toThrow('INVALID_STARTER_CONFIGURATION')
  })
})
