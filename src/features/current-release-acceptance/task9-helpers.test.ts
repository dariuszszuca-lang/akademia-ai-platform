import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { createChildCostBudget } from '../../../e2e/current-release/budget'
import { createSyntheticSourcePdf } from '../../../e2e/current-release/synthetic-source-pdf'
import {
  assertAccountExportSummary,
  assertIsolationSummary,
  calculateObservedPipelineUsage,
  createSingleSourcePipeline,
  parseSafeDeletionResponse,
  selectTargetProposals,
  summarizeAccountExport,
  summarizeIsolationResponse,
  type Task9ProposalCandidate,
} from '../../../e2e/current-release/task9-helpers'

const sourceId = '33333333-3333-4333-8333-333333333333'

describe('Task 9 proposal selection', () => {
  it('selects the same targets when proposals are reversed', () => {
    const proposals = [
      proposal('area', 'area.usable', 'conflict'),
      proposal('price', 'price.asking', 'pending'),
    ]

    const forward = selectTargetProposals(proposals)
    const reversed = selectTargetProposals([...proposals].reverse())

    expect(forward.area.id).toBe('area')
    expect(forward.price.id).toBe('price')
    expect(reversed).toEqual(forward)
  })

  it('ignores unrelated extra proposals', () => {
    const selected = selectTargetProposals([
      proposal('extra', 'rooms.count', 'pending'),
      proposal('price', 'price.asking', 'pending'),
      proposal('area', 'area.usable', 'conflict'),
    ])

    expect(selected.area.id).toBe('area')
    expect(selected.price.id).toBe('price')
  })

  it('fails with a stable error when fewer than two targets exist', () => {
    expect(() =>
      selectTargetProposals([
        proposal('price', 'price.asking', 'pending'),
      ]),
    ).toThrow('STUDIO_PROPOSAL_SET_INVALID')
  })

  it('fails with a stable error when a target key is duplicated', () => {
    expect(() =>
      selectTargetProposals([
        proposal('area-1', 'area.usable', 'conflict'),
        proposal('area-2', 'area.usable', 'conflict'),
        proposal('price', 'price.asking', 'pending'),
      ]),
    ).toThrow('STUDIO_PROPOSAL_SET_INVALID')
  })

  it('rejects an equal-value area proposal that is pending', () => {
    expect(() =>
      selectTargetProposals([
        proposal('area', 'area.usable', 'pending', 80),
        proposal('price', 'price.asking', 'pending'),
      ]),
    ).toThrow('STUDIO_AREA_CONFLICT_MISSING')
  })

  it('rejects a price proposal that is not pending', () => {
    expect(() =>
      selectTargetProposals([
        proposal('area', 'area.usable', 'conflict'),
        proposal('price', 'price.asking', 'conflict'),
      ]),
    ).toThrow('STUDIO_PRICE_PENDING_MISSING')
  })
})

describe('Task 9 source accounting', () => {
  it('sums observed cost and model IDs only for the current source', () => {
    const usage = calculateObservedPipelineUsage(
      [
        {
          sourceId,
          providerCostMicrounits: 125_000,
          modelId: 'model-a',
        },
        {
          sourceId: '44444444-4444-4444-8444-444444444444',
          providerCostMicrounits: 999_999,
          modelId: 'other-model',
        },
        {
          sourceId,
          providerCostMicrounits: 25_000,
          modelId: 'model-a',
        },
        {
          sourceId,
          providerCostMicrounits: 0,
          modelId: 'model-b',
        },
      ],
      sourceId,
    )

    expect(usage).toEqual({
      observedPipelineCostUsd: 0.15,
      modelIds: ['model-a', 'model-b'],
    })
  })

  it('keeps the pipeline call counter at exactly one in every proposal branch', async () => {
    const branches: Task9ProposalCandidate[][] = [
      [
        proposal('area', 'area.usable', 'conflict'),
        proposal('price', 'price.asking', 'pending'),
      ],
      [proposal('price', 'price.asking', 'pending')],
      [
        proposal('area-1', 'area.usable', 'conflict'),
        proposal('area-2', 'area.usable', 'conflict'),
        proposal('price', 'price.asking', 'pending'),
      ],
      [
        proposal('area', 'area.usable', 'pending', 80),
        proposal('price', 'price.asking', 'pending'),
      ],
    ]

    for (const proposals of branches) {
      const budget = createBudget()
      const pipeline = createSingleSourcePipeline(budget)
      let uploadCalls = 0

      await pipeline.run(async () => {
        uploadCalls += 1
      })
      try {
        selectTargetProposals(proposals)
      } catch {
        // A failed target set must not cause another upload attempt.
      }

      expect(uploadCalls).toBe(1)
      expect(pipeline.calls()).toBe(1)
      expect(budget.snapshot().sourcePipelineCalls).toBe(1)
    }
  })

  it('rejects a second source pipeline action without reserving it', async () => {
    const budget = createBudget()
    const pipeline = createSingleSourcePipeline(budget)

    await pipeline.run(async () => {})

    await expect(pipeline.run(async () => {})).rejects.toThrow(
      'STUDIO_SOURCE_PIPELINE_ALREADY_USED',
    )
    expect(budget.snapshot().sourcePipelineCalls).toBe(1)
  })
})

describe('Task 9 safe summaries', () => {
  it('reduces isolation responses to booleans and never throws the body', () => {
    const clean = summarizeIsolationResponse(
      404,
      '{"error":"not_found"}',
      ['SYN run-id', 'project-id'],
    )
    expect(clean).toEqual({
      statusIs404: true,
      payloadIsNotFound: true,
      identifiersAbsent: true,
    })
    expect(() => assertIsolationSummary(clean)).not.toThrow()

    const leaked = summarizeIsolationResponse(
      404,
      '{"error":"not_found","detail":"SYN secret-marker"}',
      ['SYN secret-marker'],
    )
    expect(() => assertIsolationSummary(leaked)).toThrow(
      'ISOLATION_RESPONSE_INVALID',
    )
    try {
      assertIsolationSummary(leaked)
    } catch (error) {
      expect(String(error)).not.toContain('secret-marker')
    }
  })

  it('summarizes current export resources and matching source jobs in memory', () => {
    const summary = summarizeAccountExport(
      {
        userId: 'subject-a',
        profil: { markdown: 'profil' },
        personaBuyer: { markdown: 'buyer' },
        personaSeller: { markdown: 'seller' },
        propertyStudio: {
          projects: [{ id: 'project-a' }],
          facts: [{ id: 'fact-a' }],
          sources: [{ id: sourceId }],
          factProposals: [{ id: 'area' }, { id: 'price' }],
          sourceJobs: [
            {
              sourceId,
              providerCostMicrounits: 250_000,
              modelId: 'model-current',
            },
            {
              sourceId: 'source-b',
              providerCostMicrounits: 900_000,
              modelId: 'model-b',
            },
          ],
          productEvents: [{ name: 'account.exported' }],
        },
      },
      {
        subjectA: 'subject-a',
        currentResourceIds: [
          'project-a',
          'fact-a',
          sourceId,
          'area',
          'price',
        ],
        sourceId,
        forbiddenBIdentifiers: ['subject-b', 'marker-b'],
      },
    )

    expect(summary).toEqual({
      userMatches: true,
      profilePresent: true,
      personasPresent: true,
      currentResourcesPresent: true,
      accountExportedEventPresent: true,
      forbiddenBIdentifiersAbsent: true,
      forbiddenCredentialKeysAbsent: true,
      observedPipelineCostUsd: 0.25,
      modelIds: ['model-current'],
    })
    expect(() => assertAccountExportSummary(summary)).not.toThrow()
  })

  it('detects forbidden credential keys recursively without returning values', () => {
    const summary = summarizeAccountExport(
      {
        userId: 'subject-a',
        profil: { markdown: 'profil' },
        personaBuyer: { markdown: 'buyer' },
        personaSeller: { markdown: 'seller' },
        propertyStudio: {
          projects: [{ id: 'project-a' }],
          facts: [{ id: 'fact-a' }],
          sources: [{ id: sourceId }],
          factProposals: [{ id: 'area' }, { id: 'price' }],
          sourceJobs: [],
          productEvents: [{ name: 'account.exported' }],
        },
        nested: { password: 'must-never-be-returned' },
      },
      {
        subjectA: 'subject-a',
        currentResourceIds: [
          'project-a',
          'fact-a',
          sourceId,
          'area',
          'price',
        ],
        sourceId,
        forbiddenBIdentifiers: ['subject-b'],
      },
    )

    expect(summary.forbiddenCredentialKeysAbsent).toBe(false)
    expect(() => assertAccountExportSummary(summary)).toThrow(
      'ACCOUNT_EXPORT_INVALID',
    )
    expect(JSON.stringify(summary)).not.toContain(
      'must-never-be-returned',
    )
  })

  it('parses only the safe deletion receipt', () => {
    expect(
      parseSafeDeletionResponse({
        ok: true,
        deleted: {
          sourceObjects: 3,
          propertyStudio: 1,
          accountKeys: 5,
        },
      }),
    ).toEqual({
      ok: true,
      sourceObjects: 3,
      propertyStudio: 1,
      accountKeys: 5,
    })

    expect(() =>
      parseSafeDeletionResponse({
        ok: true,
        deleted: {
          sourceObjects: -1,
          propertyStudio: 1,
          accountKeys: 5,
        },
      }),
    ).toThrow('ACCOUNT_DELETION_RECEIPT_INVALID')
  })
})

describe('Task 9 synthetic source PDF', () => {
  it('writes one bounded ASCII-safe page with the run marker in mode 0600', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'task9-source-pdf-'),
    )
    const runId = 'syn-20260729T203000Z-a1b2c3d4'

    try {
      const result = await createSyntheticSourcePdf({
        browserDirectory: directory,
        runId,
      })
      const file = await stat(result.path)
      const document = await PDFDocument.load(
        await readFile(result.path),
      )

      expect(result.sizeBytes).toBe(file.size)
      expect(file.size).toBeGreaterThan(0)
      expect(file.size).toBeLessThanOrEqual(25 * 1024 * 1024)
      expect(file.mode & 0o777).toBe(0o600)
      expect(document.getPageCount()).toBe(1)
      expect(document.getTitle()).toContain(runId)
      expect(document.getSubject()).toContain('83,40 m2')
      expect(document.getSubject()).toContain('750 000 PLN')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})

function proposal(
  id: string,
  factKey: string,
  status: Task9ProposalCandidate['status'],
  value: unknown = id === 'area' ? 83.4 : 750_000,
): Task9ProposalCandidate {
  return {
    id,
    factKey,
    status,
    label:
      factKey === 'area.usable'
        ? 'Powierzchnia użytkowa'
        : 'Cena ofertowa',
    value,
  }
}

function createBudget() {
  return createChildCostBudget({
    maxUsd: 2,
    stopBeforeUsd: 1.5,
    unitCosts: {
      onboardingGenerationUsd: 0.06,
      agentCallUsd: 0.08,
      sourcePipelineUsd: 0.25,
    },
  })
}
