import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Task9Runtime } from '../../../e2e/current-release/task9-helpers'

const task9HelpersSource = readFileSync(
  resolve(process.cwd(), 'e2e/current-release/task9-helpers.ts'),
  'utf8',
)
const studioSource = readFileSync(
  resolve(
    process.cwd(),
    'e2e/current-release/scenarios/studio.ts',
  ),
  'utf8',
)

describe('Task 9 Studio crash-safe journal contract', () => {
  it('accepts cleanup identifiers in runtime resource records', () => {
    const record: Parameters<
      Task9Runtime['recordResources']
    >[0] = {
      organizationId: '11111111-1111-4111-8111-111111111111',
      factId: '22222222-2222-4222-8222-222222222222',
      sourceJobId: '33333333-3333-4333-8333-333333333333',
      proposalId: '44444444-4444-4444-8444-444444444444',
    }

    expect(record).toEqual({
      organizationId: '11111111-1111-4111-8111-111111111111',
      factId: '22222222-2222-4222-8222-222222222222',
      sourceJobId: '33333333-3333-4333-8333-333333333333',
      proposalId: '44444444-4444-4444-8444-444444444444',
    })
    expect(task9HelpersSource).toMatch(
      /recordResources\(input: \{[\s\S]*?factId\?: string[\s\S]*?sourceJobId\?: string[\s\S]*?proposalId\?: string[\s\S]*?\}\): Promise<void>/,
    )
  })

  it('journals the source job and both proposals before state mutation or decisions', () => {
    const selectionStart = studioSource.indexOf(
      'const selected = selectTargetProposals(candidates)',
    )
    const selectionMutation = studioSource.indexOf(
      'selectedProposals = selected',
      selectionStart,
    )
    const firstDecision = studioSource.indexOf(
      'const areaResult = await decideProposalFromUi',
      selectionStart,
    )

    expect(selectionStart).toBeGreaterThan(-1)
    expect(selectionMutation).toBeGreaterThan(selectionStart)
    expect(firstDecision).toBeGreaterThan(selectionMutation)

    const beforeMutation = studioSource.slice(
      selectionStart,
      selectionMutation,
    )
    expect(beforeMutation).toContain(
      'sourceJobId: selected.area.jobId',
    )
    expect(beforeMutation).toContain(
      'proposalId: selected.area.id',
    )
    expect(beforeMutation).toContain(
      'proposalId: selected.price.id',
    )
  })
})
