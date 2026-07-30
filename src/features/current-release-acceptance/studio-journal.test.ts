import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type {
  Task9Runtime,
  Task9SelectedProposals,
} from '../../../e2e/current-release/task9-helpers'

const organizationId =
  '11111111-1111-4111-8111-111111111111'
const selectedProposals: Task9SelectedProposals = {
  area: {
    id: '22222222-2222-4222-8222-222222222222',
    factKey: 'area.usable',
    sourceId: '33333333-3333-4333-8333-333333333333',
    jobId: '44444444-4444-4444-8444-444444444444',
    valueType: 'number',
    status: 'conflict',
    label: 'Powierzchnia użytkowa',
    value: 83.4,
  },
  price: {
    id: '55555555-5555-4555-8555-555555555555',
    factKey: 'price.asking',
    sourceId: '33333333-3333-4333-8333-333333333333',
    jobId: '44444444-4444-4444-8444-444444444444',
    valueType: 'number',
    status: 'pending',
    label: 'Cena ofertowa',
    value: 750_000,
  },
}

type JournalSelectedProposalResources = (
  recordResources: Task9Runtime['recordResources'],
  organizationId: string,
  selected: Task9SelectedProposals,
) => Promise<void>

async function loadJournalStep(): Promise<JournalSelectedProposalResources> {
  const studioModule = (await import(
    '../../../e2e/current-release/scenarios/studio'
  )) as unknown as Record<string, unknown>
  const journalStep =
    studioModule.journalSelectedProposalResources
  expect(journalStep).toBeTypeOf('function')
  return journalStep as JournalSelectedProposalResources
}

describe('Task 9 Studio crash-safe journal contract', () => {
  it('keeps fact IDs on the dedicated recordFactId callback', () => {
    type ResourceRecord = Parameters<
      Task9Runtime['recordResources']
    >[0]
    const record: ResourceRecord = {
      organizationId,
      sourceJobId: selectedProposals.area.jobId,
      proposalId: selectedProposals.area.id,
    }
    const invalidRecord: ResourceRecord = {
      organizationId,
      // @ts-expect-error fact IDs use recordFactId instead
      factId: '66666666-6666-4666-8666-666666666666',
    }

    expect(record).toEqual({
      organizationId,
      sourceJobId: selectedProposals.area.jobId,
      proposalId: selectedProposals.area.id,
    })
    expect(invalidRecord.organizationId).toBe(organizationId)
  })

  it('awaits each journal write before the next write and scope step', async () => {
    const journalSelectedProposalResources =
      await loadJournalStep()
    let releaseFirstWrite = () => {}
    const firstWriteBlocked = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve
    })
    const records: Array<
      Parameters<Task9Runtime['recordResources']>[0]
    > = []
    const recordResources: Task9Runtime['recordResources'] =
      vi.fn(async (record) => {
        records.push(record)
        if (records.length === 1) {
          await firstWriteBlocked
        }
      })
    let nextScopeReached = false

    const execution = journalSelectedProposalResources(
      recordResources,
      organizationId,
      selectedProposals,
    ).then(() => {
      nextScopeReached = true
    })
    await Promise.resolve()

    expect(records).toEqual([
      {
        organizationId,
        sourceJobId: selectedProposals.area.jobId,
      },
    ])
    expect(nextScopeReached).toBe(false)

    releaseFirstWrite()
    await execution

    expect(records).toEqual([
      {
        organizationId,
        sourceJobId: selectedProposals.area.jobId,
      },
      {
        organizationId,
        proposalId: selectedProposals.area.id,
      },
      {
        organizationId,
        proposalId: selectedProposals.price.id,
      },
    ])
    expect(nextScopeReached).toBe(true)
  })

  it('does not reach a proposal decision when journaling rejects', async () => {
    const journalSelectedProposalResources =
      await loadJournalStep()
    const journalError = new Error('journal failed')
    const recordResources: Task9Runtime['recordResources'] =
      vi.fn().mockRejectedValueOnce(journalError)
    const decideProposal = vi.fn()

    const execution = (async () => {
      await journalSelectedProposalResources(
        recordResources,
        organizationId,
        selectedProposals,
      )
      decideProposal()
    })()

    await expect(execution).rejects.toBe(journalError)
    expect(recordResources).toHaveBeenCalledTimes(1)
    expect(decideProposal).not.toHaveBeenCalled()
  })

  it('awaits journaling immediately after selecting proposals', () => {
    const studioSource = readFileSync(
      resolve(
        process.cwd(),
        'e2e/current-release/scenarios/studio.ts',
      ),
      'utf8',
    )
    const selection =
      'const selected = selectTargetProposals(candidates)'
    const selectionStart = studioSource.indexOf(selection)
    const selectionEnd = selectionStart + selection.length
    const journalAwait = studioSource.indexOf(
      'await journalSelectedProposalResources(',
      selectionEnd,
    )
    const scopeValidation = studioSource.indexOf(
      'if (selected.area.sourceId !== createdSourceId)',
      selectionEnd,
    )

    expect(selectionStart).toBeGreaterThan(-1)
    expect(journalAwait).toBe(selectionEnd + 7)
    expect(journalAwait).toBeLessThan(scopeValidation)
    expect(
      studioSource.slice(selectionEnd, journalAwait).trim(),
    ).toBe('')
  })
})
