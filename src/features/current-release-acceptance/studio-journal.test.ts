import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
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

const journalWrites = [
  {
    name: 'source job',
    record: {
      organizationId,
      sourceJobId: selectedProposals.area.jobId,
    },
  },
  {
    name: 'area proposal',
    record: {
      organizationId,
      proposalId: selectedProposals.area.id,
    },
  },
  {
    name: 'price proposal',
    record: {
      organizationId,
      proposalId: selectedProposals.price.id,
    },
  },
] as const

async function loadJournalStep(): Promise<JournalSelectedProposalResources> {
  const studioModule = (await import(
    '../../../e2e/current-release/scenarios/studio'
  )) as unknown as Record<string, unknown>
  const journalStep =
    studioModule.journalSelectedProposalResources
  expect(journalStep).toBeTypeOf('function')
  return journalStep as JournalSelectedProposalResources
}

async function runJournalThenScenarioSteps(
  journalSelectedProposalResources: JournalSelectedProposalResources,
  recordResources: Task9Runtime['recordResources'],
  events: string[],
): Promise<void> {
  await journalSelectedProposalResources(
    recordResources,
    organizationId,
    selectedProposals,
  )
  events.push('validation', 'mutation', 'decision')
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

  it.each(
    journalWrites.map((write, index) => ({
      index,
      name: write.name,
    })),
  )(
    'blocks later writes and scenario steps while $name is pending',
    async ({ index: blockedIndex }) => {
      const journalSelectedProposalResources =
        await loadJournalStep()
      let releaseBlockedWrite = () => {}
      let markBlockedWriteReached = () => {}
      const blockedWriteReleased = new Promise<void>(
        (resolve) => {
          releaseBlockedWrite = resolve
        },
      )
      const blockedWriteReached = new Promise<void>((resolve) => {
        markBlockedWriteReached = resolve
      })
      const events: string[] = []
      let callIndex = 0
      const recordResources: Task9Runtime['recordResources'] =
        async (record) => {
          const currentIndex = callIndex
          callIndex += 1
          events.push(journalWrites[currentIndex]!.name)
          expect(record).toEqual(
            journalWrites[currentIndex]!.record,
          )
          if (currentIndex === blockedIndex) {
            markBlockedWriteReached()
            await blockedWriteReleased
          }
        }

      const execution = runJournalThenScenarioSteps(
        journalSelectedProposalResources,
        recordResources,
        events,
      )
      await blockedWriteReached
      await Promise.resolve()
      await Promise.resolve()

      expect(events).toEqual(
        journalWrites
          .slice(0, blockedIndex + 1)
          .map((write) => write.name),
      )
      expect(events).not.toContain('validation')
      expect(events).not.toContain('mutation')
      expect(events).not.toContain('decision')

      releaseBlockedWrite()
      await execution

      expect(events).toEqual([
        ...journalWrites.map((write) => write.name),
        'validation',
        'mutation',
        'decision',
      ])
    },
  )

  it.each(
    journalWrites.map((write, index) => ({
      index,
      name: write.name,
    })),
  )(
    'stops later writes and scenario steps when $name rejects',
    async ({ index: rejectedIndex }) => {
      const journalSelectedProposalResources =
        await loadJournalStep()
      const journalError = new Error(
        `journal write ${rejectedIndex} failed`,
      )
      const events: string[] = []
      let callIndex = 0
      const recordResources: Task9Runtime['recordResources'] = (
        record,
      ) => {
        const currentIndex = callIndex
        callIndex += 1
        events.push(journalWrites[currentIndex]!.name)
        expect(record).toEqual(
          journalWrites[currentIndex]!.record,
        )
        if (currentIndex !== rejectedIndex) {
          return Promise.resolve()
        }
        const rejection = Promise.reject(journalError)
        void rejection.catch(() => {})
        return rejection
      }

      const execution = runJournalThenScenarioSteps(
        journalSelectedProposalResources,
        recordResources,
        events,
      )

      await expect(execution).rejects.toBe(journalError)
      expect(events).toEqual(
        journalWrites
          .slice(0, rejectedIndex + 1)
          .map((write) => write.name),
      )
      expect(events).not.toContain('validation')
      expect(events).not.toContain('mutation')
      expect(events).not.toContain('decision')
    },
  )

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
