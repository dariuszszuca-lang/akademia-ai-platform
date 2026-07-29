import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { createChildCostBudget } from '../../../e2e/current-release/budget'
import { createSyntheticSourcePdf } from '../../../e2e/current-release/synthetic-source-pdf'
import {
  assertAccountExportSummary,
  assertDownloadedPdfSummary,
  assertIsolationSummary,
  assertRejectedAdminLogin,
  assertUiIsolationSummary,
  calculateObservedPipelineUsage,
  createSingleSourcePipeline,
  parseAdminAgentState,
  parseFactUpdateResponse,
  parsePersistedFactList,
  parseProposalDecisionReadback,
  parseSafeDeletionResponse,
  selectTargetProposals,
  summarizeAccountExport,
  summarizeDownloadedPdf,
  summarizeIsolationResponse,
  summarizeUiIsolationResponse,
  type Task9ProposalCandidate,
} from '../../../e2e/current-release/task9-helpers'

const sourceId = '33333333-3333-4333-8333-333333333333'
const projectId = '22222222-2222-4222-8222-222222222222'
const factId = '55555555-5555-4555-8555-555555555555'
const organizationId = '11111111-1111-4111-8111-111111111111'
const jobId = '77777777-7777-4777-8777-777777777777'

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

  it('requires exact normalized numeric values extracted from the synthetic PDF', () => {
    expect(() =>
      selectTargetProposals([
        proposal('area', 'area.usable', 'conflict', '83.4'),
        proposal('price', 'price.asking', 'pending'),
      ]),
    ).toThrow('STUDIO_AREA_VALUE_INVALID')
    expect(() =>
      selectTargetProposals([
        proposal('area', 'area.usable', 'conflict'),
        proposal('price', 'price.asking', 'pending', 750_001),
      ]),
    ).toThrow('STUDIO_PRICE_VALUE_INVALID')
  })

  it('reads back one accepted area and one rejected price by exact IDs and keys', () => {
    const summary = parseProposalDecisionReadback(
      {
        proposals: [
          {
            id: 'price',
            factKey: 'price.asking',
            status: 'rejected',
            valueType: 'number',
            value: 750_000,
            sourceId,
            jobId,
          },
          {
            id: 'area',
            factKey: 'area.usable',
            status: 'accepted',
            valueType: 'number',
            value: 83.4,
            sourceId,
            jobId,
          },
        ],
      },
      {
        acceptedId: 'area',
        rejectedId: 'price',
        sourceId,
        jobId,
      },
    )

    expect(summary).toEqual({
      accepted: {
        id: 'area',
        factKey: 'area.usable',
        status: 'accepted',
      },
      rejected: {
        id: 'price',
        factKey: 'price.asking',
        status: 'rejected',
      },
    })
    expect(() =>
      parseProposalDecisionReadback(
        {
          proposals: [
            {
              id: 'area',
              factKey: 'area.usable',
              status: 'needs_review',
              valueType: 'number',
              value: 83.4,
              sourceId,
              jobId,
            },
            {
              id: 'price',
              factKey: 'price.asking',
              status: 'rejected',
              valueType: 'number',
              value: 750_000,
              sourceId,
              jobId,
            },
          ],
        },
        {
          acceptedId: 'area',
          rejectedId: 'price',
          sourceId,
          jobId,
        },
      ),
    ).toThrow('STUDIO_PROPOSAL_READBACK_INVALID')
  })

  it('rejects any extra terminal proposal in the current source job set', () => {
    expect(() =>
      parseProposalDecisionReadback(
        {
          proposals: [
            {
              id: 'area',
              factKey: 'area.usable',
              status: 'accepted',
              valueType: 'number',
              value: 83.4,
              sourceId,
              jobId,
            },
            {
              id: 'price',
              factKey: 'price.asking',
              status: 'rejected',
              valueType: 'number',
              value: 750_000,
              sourceId,
              jobId,
            },
            {
              id: 'extra',
              factKey: 'rooms.count',
              status: 'rejected',
              valueType: 'number',
              value: 3,
              sourceId,
              jobId,
            },
          ],
        },
        {
          acceptedId: 'area',
          rejectedId: 'price',
          sourceId,
          jobId,
        },
      ),
    ).toThrow('STUDIO_PROPOSAL_READBACK_INVALID')
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

  it('reduces a blocked UI navigation to booleans without persisting page text', () => {
    const clean = summarizeUiIsolationResponse({
      status: 404,
      visibleText: '404 This page could not be found.',
      workspaceVisible: false,
      forbiddenIdentifiers: ['SYN private-title', projectId],
    })

    expect(clean).toEqual({
      accessBlocked: true,
      workspaceAbsent: true,
      identifiersAbsent: true,
    })
    expect(() => assertUiIsolationSummary(clean)).not.toThrow()

    const leaked = summarizeUiIsolationResponse({
      status: 404,
      visibleText: `404 SYN private-title ${projectId}`,
      workspaceVisible: false,
      forbiddenIdentifiers: ['SYN private-title', projectId],
    })
    expect(() => assertUiIsolationSummary(leaked)).toThrow(
      'ISOLATION_UI_ACCESSIBLE',
    )
    expect(JSON.stringify(leaked)).not.toContain('private-title')
  })

  it('validates a persisted fact edit without returning the response body', () => {
    const summary = parseFactUpdateResponse(
      {
        fact: {
          id: factId,
          propertyProjectId: projectId,
          key: 'area.usable',
          label: 'Powierzchnia użytkowa',
          valueType: 'number',
          value: 81,
          unit: 'm²',
          status: 'confirmed',
          visibility: 'internal',
          confirmedByUserId: 'subject-a',
          version: 2,
        },
      },
      {
        factId,
        projectId,
        subjectA: 'subject-a',
        value: 81,
        version: 2,
      },
    )

    expect(summary).toEqual({
      factId,
      value: 81,
      version: 2,
      status: 'confirmed',
      visibility: 'internal',
    })
    expect(() =>
      parseFactUpdateResponse(
        {
          fact: {
            id: factId,
            propertyProjectId: projectId,
            key: 'area.usable',
            label: 'Powierzchnia użytkowa',
            valueType: 'number',
            value: 81,
            unit: 'm²',
            status: 'confirmed',
            visibility: 'internal',
            confirmedByUserId: 'subject-a',
            version: 1,
          },
        },
        {
          factId,
          projectId,
          subjectA: 'subject-a',
          value: 81,
          version: 2,
        },
      ),
    ).toThrow('STUDIO_FACT_UPDATE_INVALID')
  })

  it('validates the final fact through an independent list readback', () => {
    const summary = parsePersistedFactList(
      {
        facts: [
          {
            id: factId,
            propertyProjectId: projectId,
            key: 'area.usable',
            label: 'Powierzchnia użytkowa',
            valueType: 'number',
            value: 80,
            unit: 'm²',
            status: 'confirmed',
            visibility: 'internal',
            confirmedByUserId: 'subject-a',
            version: 3,
          },
        ],
      },
      {
        factId,
        projectId,
        subjectA: 'subject-a',
        value: 80,
        version: 3,
      },
    )

    expect(summary).toEqual({
      factId,
      key: 'area.usable',
      value: 80,
      version: 3,
      status: 'confirmed',
      visibility: 'internal',
    })
    expect(() =>
      parsePersistedFactList(
        {
          facts: [
            {
              id: factId,
              propertyProjectId: projectId,
              key: 'area.usable',
              label: 'Powierzchnia użytkowa',
              valueType: 'number',
              value: 81,
              unit: 'm²',
              status: 'confirmed',
              visibility: 'internal',
              confirmedByUserId: 'subject-a',
              version: 3,
            },
          ],
        },
        {
          factId,
          projectId,
          subjectA: 'subject-a',
          value: 80,
          version: 3,
        },
      ),
    ).toThrow('STUDIO_FACT_READBACK_INVALID')
  })

  it('reduces a downloaded PDF to bounded evidence without retaining bytes or a URL', () => {
    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.7\n', 'ascii'),
      Buffer.alloc(200, 65),
    ])
    const summary = summarizeDownloadedPdf({
      status: 200,
      contentType: 'application/pdf',
      body: pdf,
    })

    expect(summary).toEqual({
      statusIs200: true,
      contentTypeIsPdf: true,
      bodyLooksLikePdf: true,
      bodySizeBytes: pdf.byteLength,
    })
    expect(() => assertDownloadedPdfSummary(summary)).not.toThrow()
    expect(JSON.stringify(summary)).not.toContain('%PDF')

    expect(() =>
      assertDownloadedPdfSummary(
        summarizeDownloadedPdf({
          status: 200,
          contentType: 'text/html',
          body: Buffer.from('<html>not a pdf</html>'),
        }),
      ),
    ).toThrow('STUDIO_SOURCE_DOWNLOAD_INVALID')
  })

  it('requires an explicit rejected admin password response', () => {
    expect(() =>
      assertRejectedAdminLogin(401, {
        error: 'Invalid password',
      }),
    ).not.toThrow()
    expect(() =>
      assertRejectedAdminLogin(200, { ok: true }),
    ).toThrow('ADMIN_INVALID_PASSWORD_NOT_REJECTED')
  })

  it('requires configured KV while parsing the exact admin agent state', () => {
    expect(
      parseAdminAgentState(
        {
          agents: [
            { id: 'publikacja', enabled: true },
            { id: 'prawny', enabled: false },
          ],
          kv: { configured: true },
        },
        'publikacja',
      ),
    ).toEqual({ enabled: true, kvConfigured: true })

    expect(() =>
      parseAdminAgentState(
        {
          agents: [{ id: 'publikacja', enabled: true }],
          kv: { configured: false },
        },
        'publikacja',
      ),
    ).toThrow('ADMIN_KV_UNAVAILABLE')
  })

  it('summarizes current export resources and matching source jobs in memory', () => {
    const summary = summarizeAccountExport(
      validAccountExport(),
      accountExportExpectation(true),
    )

    expect(summary).toEqual({
      userMatches: true,
      profilePresent: true,
      personasPresent: true,
      onboardingPresent: true,
      subscriptionStatePresent: true,
      pilotAccessModeConfirmed: true,
      currentResourcesPresent: true,
      currentSourceJobPresent: true,
      auditEvidencePresent: true,
      studioEventsPresent: true,
      accountExportedEventPresent: true,
      forbiddenBIdentifiersAbsent: true,
      forbiddenCredentialKeysAbsent: true,
      observedPipelineCostUsd: 0.25,
      modelIds: ['model-current'],
    })
    expect(() => assertAccountExportSummary(summary)).not.toThrow()
  })

  it('detects forbidden credential keys recursively without returning values', () => {
    const payload = {
      ...validAccountExport(),
      nested: { password: 'must-never-be-returned' },
    }
    const summary = summarizeAccountExport(
      payload,
      accountExportExpectation(true),
    )

    expect(summary.forbiddenCredentialKeysAbsent).toBe(false)
    expect(() => assertAccountExportSummary(summary)).toThrow(
      'ACCOUNT_EXPORT_INVALID',
    )
    expect(JSON.stringify(summary)).not.toContain(
      'must-never-be-returned',
    )
  })

  it('fails closed without onboarding, subscription state, or explicit pilot access mode', () => {
    const {
      onboarding: _onboarding,
      subscription: _subscription,
      ...payload
    } = validAccountExport()
    void _onboarding
    void _subscription
    const summary = summarizeAccountExport(
      payload,
      accountExportExpectation(false),
    )

    expect(summary).toMatchObject({
      onboardingPresent: false,
      subscriptionStatePresent: false,
      pilotAccessModeConfirmed: false,
    })
    expect(() => assertAccountExportSummary(summary)).toThrow(
      'ACCOUNT_EXPORT_INVALID',
    )
  })

  it('rejects empty Studio collections even when every ID exists in recursive noise', () => {
    const payload = {
      ...validAccountExport(),
      propertyStudio: {
        projects: [],
        facts: [],
        sources: [],
        factProposals: [],
        sourceJobs: [],
        audit: [],
        productEvents: [],
        noise: {
          projectId,
          factId,
          sourceId,
          jobId,
          acceptedProposalId: 'area',
          rejectedProposalId: 'price',
          events: [
            'property.created',
            'fact.created',
            'fact.updated',
            'source.registered',
            'source.review_ready',
            'proposal.decided',
            'account.exported',
          ],
        },
      },
    }
    const summary = summarizeAccountExport(
      payload,
      accountExportExpectation(true),
    )

    expect(summary).toMatchObject({
      currentResourcesPresent: false,
      currentSourceJobPresent: false,
      auditEvidencePresent: false,
      studioEventsPresent: false,
      accountExportedEventPresent: false,
    })
    expect(() => assertAccountExportSummary(summary)).toThrow(
      'ACCOUNT_EXPORT_INVALID',
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
    sourceId,
    jobId,
    valueType: 'number',
    label:
      factKey === 'area.usable'
        ? 'Powierzchnia użytkowa'
        : 'Cena ofertowa',
    value,
  }
}

function validAccountExport() {
  return {
    userId: 'subject-a',
    profil: { markdown: 'profil' },
    personaBuyer: { markdown: 'buyer' },
    personaSeller: { markdown: 'seller' },
    onboarding: {
      currentStep: 'deep',
      expressAnswers: { q1: 'synthetic-answer' },
    },
    subscription: {
      plan: 'trial',
      status: 'trialing',
    },
    propertyStudio: {
      projects: [{ id: projectId, organizationId }],
      facts: [
        {
          id: factId,
          propertyProjectId: projectId,
          key: 'area.usable',
        },
      ],
      sources: [
        {
          id: sourceId,
          organizationId,
          propertyProjectId: projectId,
        },
      ],
      factProposals: [
        {
          id: 'area',
          propertyProjectId: projectId,
          sourceId,
          jobId,
          factKey: 'area.usable',
          status: 'accepted',
          valueType: 'number',
          value: 83.4,
        },
        {
          id: 'price',
          propertyProjectId: projectId,
          sourceId,
          jobId,
          factKey: 'price.asking',
          status: 'rejected',
          valueType: 'number',
          value: 750_000,
        },
      ],
      sourceJobs: [
        {
          id: jobId,
          organizationId,
          propertyProjectId: projectId,
          sourceId,
          status: 'succeeded',
          providerCostMicrounits: 250_000,
          modelId: 'model-current',
        },
      ],
      audit: [
        {
          propertyProjectId: projectId,
          action: 'property.created',
          entityId: projectId,
        },
        {
          propertyProjectId: projectId,
          action: 'fact.created',
          entityId: factId,
        },
        {
          propertyProjectId: projectId,
          action: 'fact.updated',
          entityId: factId,
        },
        {
          propertyProjectId: projectId,
          action: 'source.registered',
          entityId: sourceId,
        },
        {
          propertyProjectId: projectId,
          action: 'proposal.decided',
          entityId: 'area',
        },
        {
          propertyProjectId: projectId,
          action: 'proposal.decided',
          entityId: 'price',
        },
      ],
      productEvents: [
        { name: 'property.created', propertyProjectId: projectId },
        { name: 'fact.created', propertyProjectId: projectId },
        { name: 'fact.updated', propertyProjectId: projectId },
        { name: 'source.registered', propertyProjectId: projectId },
        {
          name: 'source.review_ready',
          propertyProjectId: projectId,
        },
        { name: 'proposal.decided', propertyProjectId: projectId },
        { name: 'proposal.decided', propertyProjectId: projectId },
        { name: 'account.exported', propertyProjectId: null },
      ],
    },
  }
}

function accountExportExpectation(
  pilotAccessModeConfirmed: boolean,
) {
  return {
    subjectA: 'subject-a',
    organizationId,
    projectId,
    factId,
    sourceId,
    sourceJobId: jobId,
    acceptedProposalId: 'area',
    rejectedProposalId: 'price',
    forbiddenBIdentifiers: ['subject-b', 'marker-b'],
    pilotAccessModeConfirmed,
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
