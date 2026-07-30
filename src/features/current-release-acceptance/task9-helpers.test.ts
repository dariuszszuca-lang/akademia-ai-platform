import { createHash } from 'node:crypto'
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { createChildCostBudget } from '../../../e2e/current-release/budget'
import {
  createSyntheticSourcePdf,
  removeSyntheticSourcePdf,
  usingSyntheticSourcePdf,
  type SyntheticSourcePdf,
} from '../../../e2e/current-release/synthetic-source-pdf'
import {
  assertAccountExportSummary,
  assertDownloadedPdfSummary,
  assertIsolationSummary,
  assertMobileFocusBorderEvidence,
  assertRejectedAdminLogin,
  assertUiIsolationSummary,
  calculateObservedPipelineUsage,
  createSingleSourcePipeline,
  parseAcceptedAreaDecisionResponse,
  parseAcceptedAreaFactList,
  parseAdminAgentState,
  parseFactUpdateResponse,
  parsePdfDownloadHeaders,
  parsePersistedFactList,
  parseCurrentSourceJobEvidence,
  parseProposalDecisionReadback,
  parseRejectedPriceDecisionResponse,
  parseSafeDeletionResponse,
  parseSignedS3DownloadUrl,
  recordTask9Usage,
  runAdminFinallyProtocol,
  selectTargetProposals,
  summarizeAccountExport,
  summarizeDownloadedPdf,
  summarizeIsolationResponse,
  summarizePilotAccessEvidence,
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

  it('binds the accepted area response and independent fact readback to the original fact', () => {
    const decision = parseAcceptedAreaDecisionResponse(
      {
        proposal: {
          id: 'area',
          factKey: 'area.usable',
          status: 'accepted',
          sourceId,
          jobId,
          valueType: 'number',
          value: 83.4,
        },
        fact: acceptedAreaFact(4),
        decisionCreated: true,
      },
      {
        proposalId: 'area',
        factId,
        projectId,
        subjectA: 'subject-a',
        sourceId,
        jobId,
        preAcceptVersion: 3,
      },
    )
    expect(decision).toEqual({
      proposalId: 'area',
      factId,
      version: 4,
      value: 83.4,
    })

    expect(
      parseAcceptedAreaFactList(
        { facts: [acceptedAreaFact(4)] },
        {
          factId,
          projectId,
          subjectA: 'subject-a',
          sourceId,
          version: decision.version,
        },
      ),
    ).toEqual({
      factId,
      version: 4,
      value: 83.4,
      factCount: 1,
    })

    expect(() =>
      parseAcceptedAreaDecisionResponse(
        {
          proposal: {
            id: 'area',
            factKey: 'area.usable',
            status: 'accepted',
            sourceId,
            jobId,
            valueType: 'number',
            value: 83.4,
          },
          fact: {
            ...acceptedAreaFact(3),
            sourceIds: [],
          },
          decisionCreated: true,
        },
        {
          proposalId: 'area',
          factId,
          projectId,
          subjectA: 'subject-a',
          sourceId,
          jobId,
          preAcceptVersion: 3,
        },
      ),
    ).toThrow('STUDIO_ACCEPTED_AREA_INVALID')
  })

  it('requires the rejected price response to have no fact', () => {
    expect(
      parseRejectedPriceDecisionResponse(
        {
          proposal: {
            id: 'price',
            factKey: 'price.asking',
            status: 'rejected',
            sourceId,
            jobId,
            valueType: 'number',
            value: 750_000,
          },
          fact: null,
          decisionCreated: true,
        },
        {
          proposalId: 'price',
          sourceId,
          jobId,
        },
      ),
    ).toEqual({ proposalId: 'price', factIsNull: true })

    expect(() =>
      parseRejectedPriceDecisionResponse(
        {
          proposal: {
            id: 'price',
            factKey: 'price.asking',
            status: 'rejected',
            sourceId,
            jobId,
            valueType: 'number',
            value: 750_000,
          },
          fact: acceptedAreaFact(4),
          decisionCreated: true,
        },
        {
          proposalId: 'price',
          sourceId,
          jobId,
        },
      ),
    ).toThrow('STUDIO_REJECTED_PRICE_INVALID')
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

  it('requires one costed succeeded USD job inside the shared budget', () => {
    const validJob = {
      id: jobId,
      organizationId,
      propertyProjectId: projectId,
      sourceId,
      status: 'succeeded',
      providerCostMicrounits: 250_000,
      currency: 'USD',
      modelId: 'claude-sonnet-4-6',
    }
    expect(
      parseCurrentSourceJobEvidence(
        [validJob],
        {
          organizationId,
          projectId,
          sourceId,
          jobId,
          maxUsd: 2,
          reservedUsd: 1,
          sourceReservationUsd: 0.25,
        },
      ),
    ).toEqual({
      observedPipelineCostUsd: 0.25,
      modelIds: ['claude-sonnet-4-6'],
    })

    for (const invalid of [
      { ...validJob, providerCostMicrounits: null },
      { ...validJob, providerCostMicrounits: 0 },
      { ...validJob, modelId: '   ' },
      { ...validJob, modelId: 'model current' },
      { ...validJob, currency: 'EUR' },
      // The job itself is below $2, but replacing the $0.25 reservation with
      // $1.50 would push the shared observed total to $2.25.
      { ...validJob, providerCostMicrounits: 1_500_000 },
    ]) {
      expect(() =>
        parseCurrentSourceJobEvidence(
          [invalid],
          {
            organizationId,
            projectId,
            sourceId,
            jobId,
            maxUsd: 2,
            reservedUsd: 1,
            sourceReservationUsd: 0.25,
          },
        ),
      ).toThrow('STUDIO_PIPELINE_JOB_INVALID')
    }
  })
})

describe('Task 9 safe summaries', () => {
  it.each([3, 15, 123])(
    'records an exact %i-microunit pipeline cost despite floating-point scaling',
    async (microunits) => {
      const observedPipelineCostUsd = microunits / 1_000_000
      const recorded: unknown[] = []

      const usage = await recordTask9Usage(
        {
          observedPipelineCostUsd,
          modelIds: ['claude-sonnet-4-6'],
        },
        async (value) => {
          recorded.push(value)
        },
      )

      expect(usage.observedPipelineCostUsd).toBe(
        observedPipelineCostUsd,
      )
      expect(recorded).toEqual([usage])
    },
  )

  it.each([
    'UI_MOBILE_FAILED',
    'ACCOUNT_DELETE_FAILED',
  ])(
    'records safe export usage exactly once before a later %s failure',
    async (laterError) => {
      const recorded: unknown[] = []
      const usage = {
        observedPipelineCostUsd: 0.25,
        modelIds: ['claude-sonnet-4-6'],
      }

      await expect(
        (async () => {
          await recordTask9Usage(usage, async (value: unknown) => {
            recorded.push(value)
          })
          throw new Error(laterError)
        })(),
      ).rejects.toThrow(laterError)
      expect(recorded).toEqual([usage])
    },
  )

  it('rejects zero-cost or unsafe usage before calling the recorder', async () => {
    let calls = 0
    const recordUsage = async () => {
      calls += 1
    }

    for (const invalid of [
      {
        observedPipelineCostUsd: 0,
        modelIds: ['claude-sonnet-4-6'],
      },
      {
        observedPipelineCostUsd: -0.000001,
        modelIds: ['claude-sonnet-4-6'],
      },
      {
        observedPipelineCostUsd: Number.POSITIVE_INFINITY,
        modelIds: ['claude-sonnet-4-6'],
      },
      {
        observedPipelineCostUsd: 2.000001,
        modelIds: ['claude-sonnet-4-6'],
      },
      {
        observedPipelineCostUsd: 0.0001234,
        modelIds: ['claude-sonnet-4-6'],
      },
      {
        observedPipelineCostUsd: 0.25,
        modelIds: ['token=unsafe'],
      },
    ]) {
      await expect(
        recordTask9Usage(invalid, recordUsage),
      ).rejects.toThrow('TASK9_USAGE_INVALID')
    }
    expect(calls).toBe(0)
  })

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

  it('allowlists only the exact short-lived regional S3 URL', () => {
    const expected = {
      bucketName: 'property-source-prod-261965598943',
      region: 'eu-central-1',
      storageKey:
        `originals/organizations/${organizationId}/properties/${projectId}/sources/${sourceId}/original`,
    }
    const path = `/${expected.storageKey}`
    const valid =
      `https://${expected.bucketName}.s3.${expected.region}.amazonaws.com${path}` +
      '?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=60&X-Amz-Signature=abc'

    expect(parseSignedS3DownloadUrl(valid, expected)).toEqual({
      expiresSeconds: 60,
    })
    for (const invalid of [
      valid.replace('https://', 'http://'),
      valid.replace(
        `${expected.bucketName}.s3.${expected.region}.amazonaws.com`,
        '127.0.0.1',
      ),
      valid.replace('https://', 'https://user:pass@'),
      valid.replace('.amazonaws.com', '.amazonaws.com:443'),
      valid.replace('X-Amz-Expires=60', 'X-Amz-Expires=66'),
    ]) {
      expect(() =>
        parseSignedS3DownloadUrl(invalid, expected),
      ).toThrow('STUDIO_SOURCE_DOWNLOAD_URL_INVALID')
    }
  })

  it('rejects redirects and missing or oversized content-length before reading a body', () => {
    expect(
      parsePdfDownloadHeaders(200, {
        'content-type': 'application/pdf',
        'content-length': '209',
      }),
    ).toEqual({
      contentLength: 209,
      contentType: 'application/pdf',
    })
    for (const [status, headers] of [
      [
        302,
        {
          'content-type': 'application/pdf',
          'content-length': '209',
        },
      ],
      [200, { 'content-type': 'application/pdf' }],
      [
        200,
        {
          'content-type': 'application/pdf',
          'content-length': String(25 * 1024 * 1024 + 1),
        },
      ],
    ] as const) {
      expect(() =>
        parsePdfDownloadHeaders(status, headers),
      ).toThrow('STUDIO_SOURCE_DOWNLOAD_HEADERS_INVALID')
    }
  })

  it('reduces a downloaded PDF to checksum evidence without retaining bytes or a URL', () => {
    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.7\n', 'ascii'),
      Buffer.alloc(200, 65),
    ])
    const expectedSha256 = createHash('sha256')
      .update(pdf)
      .digest('hex')
    const summary = summarizeDownloadedPdf({
      status: 200,
      contentType: 'application/pdf',
      body: pdf,
      expectedSha256,
    })

    expect(summary).toEqual({
      statusIs200: true,
      contentTypeIsPdf: true,
      bodyLooksLikePdf: true,
      bodySizeBytes: pdf.byteLength,
      sha256Matches: true,
    })
    expect(() => assertDownloadedPdfSummary(summary)).not.toThrow()
    expect(JSON.stringify(summary)).not.toContain('%PDF')

    expect(() =>
      assertDownloadedPdfSummary(
        summarizeDownloadedPdf({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.concat([
            Buffer.from('%PDF-1.7\n', 'ascii'),
            Buffer.alloc(200, 66),
          ]),
          expectedSha256,
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
      forbiddenCredentialValuesAbsent: true,
      observedPipelineCostUsd: 0.25,
      modelIds: ['claude-sonnet-4-6'],
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

  it('detects presigned, bearer, JWT, token, secret, auth, and cookie string values', () => {
    for (const forbidden of [
      'https://bucket.s3.eu-central-1.amazonaws.com/a?X-Amz-Signature=abc',
      'Bearer abc.def.ghi',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhIn0.signature',
      'token=hidden',
      'client_secret=hidden',
      'Authorization: hidden',
      'Cookie: session=hidden',
    ]) {
      const summary = summarizeAccountExport(
        {
          ...validAccountExport(),
          nested: { harmlessLabel: forbidden },
        },
        accountExportExpectation(true),
      )
      expect(summary.forbiddenCredentialValuesAbsent).toBe(false)
      expect(() => assertAccountExportSummary(summary)).toThrow(
        'ACCOUNT_EXPORT_INVALID',
      )
      expect(JSON.stringify(summary)).not.toContain(forbidden)
    }
  })

  it('derives pilot access only from exact UI evidence', () => {
    expect(
      summarizePilotAccessEvidence({
        heading: 'Dostęp pilotażowy Pro',
        status: 'Aktywny',
        description:
          'W pilotażu masz aktywne wszystkie funkcje planu Pro. Płatności są obecnie wyłączone.',
      }),
    ).toBe(true)
    expect(
      summarizePilotAccessEvidence({
        heading: 'Dostęp pilotażowy Pro',
        status: 'Aktywny',
        description: 'Płatności są aktywne.',
      }),
    ).toBe(false)
  })

  it('clears an autofocus baseline before proving a password border focus indicator', async () => {
    let focused = true
    const events: string[] = []
    await assertMobileFocusBorderEvidence({
      blur: async () => {
        events.push('blur')
        focused = false
      },
      focus: async () => {
        events.push('focus')
        focused = true
      },
      isFocused: async () => {
        events.push(`is-focused:${focused}`)
        return focused
      },
      readBorderColor: async () => {
        const color = focused ? 'rgb(189, 147, 96)' : 'rgb(60, 60, 60)'
        events.push(`border:${color}`)
        return color
      },
    })

    expect(events).toEqual([
      'blur',
      'is-focused:false',
      'border:rgb(60, 60, 60)',
      'focus',
      'is-focused:true',
      'border:rgb(189, 147, 96)',
    ])
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

  it('always attempts admin login clearing, restore, and logout while preserving the primary error', async () => {
    const operations: string[] = []
    await expect(
      runAdminFinallyProtocol({
        hadSuccessfulLogin: false,
        primaryError: new Error('PRIMARY_ADMIN_FAILURE'),
        ensureSuccessfulLogin: async () => {
          operations.push('login')
        },
        restore: async () => {
          operations.push('restore')
          throw new Error('RESTORE_FAILURE')
        },
        logout: async () => {
          operations.push('logout')
        },
      }),
    ).rejects.toThrow('PRIMARY_ADMIN_FAILURE')
    expect(operations).toEqual(['login', 'restore', 'logout'])
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
      const checksumSha256 = createHash('sha256')
        .update(await readFile(result.path))
        .digest('hex')

      expect(result.sizeBytes).toBe(file.size)
      expect(result.checksumSha256).toBe(checksumSha256)
      expect(file.size).toBeGreaterThan(0)
      expect(file.size).toBeLessThanOrEqual(25 * 1024 * 1024)
      expect(file.mode & 0o777).toBe(0o600)
      expect((await stat(directory)).mode & 0o777).toBe(0o700)
      expect(dirname(result.path)).toBe(directory)
      expect(document.getPageCount()).toBe(1)
      expect(document.getTitle()).toContain(runId)
      expect(document.getSubject()).toContain('83,40 m2')
      expect(document.getSubject()).toContain('750 000 PLN')
      await removeSyntheticSourcePdf(result, directory)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('removes the local PDF after successful evidence use and remains idempotent', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'task9-source-cleanup-success-'),
    )
    const artifacts: SyntheticSourcePdf[] = []

    try {
      const evidence = await usingSyntheticSourcePdf(
        {
          browserDirectory: directory,
          runId: 'syn-20260729T203001Z-a1b2c3d4',
        },
        async (pdf) => {
          artifacts.push(pdf)
          expect(await stat(pdf.path)).toBeDefined()
          return pdf.checksumSha256
        },
      )
      expect(evidence).toMatch(/^[a-f0-9]{64}$/)
      const artifact = artifacts[0]
      if (!artifact) throw new Error('TEST_ARTIFACT_MISSING')
      await expect(stat(artifact.path)).rejects.toMatchObject({
        code: 'ENOENT',
      })
      await expect(
        removeSyntheticSourcePdf(artifact, directory),
      ).resolves.toBeUndefined()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('removes the local PDF when registration or evidence use fails', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'task9-source-cleanup-failure-'),
    )
    let artifactPath = ''

    try {
      await expect(
        usingSyntheticSourcePdf(
          {
            browserDirectory: directory,
            runId: 'syn-20260729T203002Z-a1b2c3d4',
          },
          async (pdf: { path: string }) => {
            artifactPath = pdf.path
            throw new Error('STUDIO_SOURCE_REGISTRATION_INVALID')
          },
        ),
      ).rejects.toThrow('STUDIO_SOURCE_REGISTRATION_INVALID')
      await expect(stat(artifactPath)).rejects.toMatchObject({
        code: 'ENOENT',
      })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('creates unique direct-child artifacts without overwriting either file', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'task9-source-unique-'),
    )
    const runId = 'syn-20260729T203003Z-a1b2c3d4'

    try {
      const first = await createSyntheticSourcePdf({
        browserDirectory: directory,
        runId,
      })
      const firstBytes = await readFile(first.path)
      const second = await createSyntheticSourcePdf({
        browserDirectory: directory,
        runId,
      })

      expect(second.path).not.toBe(first.path)
      expect(dirname(first.path)).toBe(directory)
      expect(dirname(second.path)).toBe(directory)
      expect(await readFile(first.path)).toEqual(firstBytes)
      await removeSyntheticSourcePdf(first, directory)
      await removeSyntheticSourcePdf(second, directory)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('fails closed without leaking a path when an exclusive destination exists', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'task9-source-existing-'),
    )
    const runId = 'syn-20260729T203004Z-a1b2c3d4'
    const artifactId = '00000000-0000-4000-8000-000000000004'
    const artifactPath = join(
      directory,
      `task9-source-${runId}-${artifactId}.pdf`,
    )

    try {
      await writeFile(artifactPath, 'existing-artifact')
      let failure: unknown
      try {
        await createSyntheticSourcePdf(
          { browserDirectory: directory, runId },
          { createArtifactId: () => artifactId },
        )
      } catch (error) {
        failure = error
      }
      expect(String(failure)).toBe(
        'Error: SYNTHETIC_SOURCE_PDF_INVALID',
      )
      expect(String(failure)).not.toContain(directory)
      expect(String(failure)).not.toContain(artifactPath)
      expect(await readFile(artifactPath, 'utf8')).toBe(
        'existing-artifact',
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('does not follow an exclusive destination symlink or leak its path', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'task9-source-existing-symlink-'),
    )
    const runId = 'syn-20260729T203005Z-a1b2c3d4'
    const artifactId = '00000000-0000-4000-8000-000000000005'
    const artifactPath = join(
      directory,
      `task9-source-${runId}-${artifactId}.pdf`,
    )
    const outsidePath = join(directory, 'outside.pdf')

    try {
      await writeFile(outsidePath, 'outside-target')
      await symlink(outsidePath, artifactPath)
      let failure: unknown
      try {
        await createSyntheticSourcePdf(
          { browserDirectory: directory, runId },
          { createArtifactId: () => artifactId },
        )
      } catch (error) {
        failure = error
      }
      expect(String(failure)).toBe(
        'Error: SYNTHETIC_SOURCE_PDF_INVALID',
      )
      expect(String(failure)).not.toContain(artifactPath)
      expect(await readFile(outsidePath, 'utf8')).toBe(
        'outside-target',
      )
      expect((await lstat(artifactPath)).isSymbolicLink()).toBe(
        true,
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('does not chmod or write through a browser-directory symlink', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'task9-source-directory-symlink-'),
    )
    const targetDirectory = join(directory, 'target')
    const linkedDirectory = join(directory, 'browser')

    try {
      await mkdir(targetDirectory, { mode: 0o755 })
      await chmod(targetDirectory, 0o755)
      await symlink(targetDirectory, linkedDirectory)
      let failure: unknown
      try {
        await createSyntheticSourcePdf({
          browserDirectory: linkedDirectory,
          runId: 'syn-20260729T203010Z-a1b2c3d4',
        })
      } catch (error) {
        failure = error
      }
      expect(String(failure)).toBe(
        'Error: SYNTHETIC_SOURCE_PDF_INVALID',
      )
      expect(String(failure)).not.toContain(linkedDirectory)
      expect((await stat(targetDirectory)).mode & 0o777).toBe(
        0o755,
      )
      expect(await readdir(targetDirectory)).toEqual([])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('does not delete a regular file swapped in before cleanup', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'task9-source-race-'),
    )
    const runId = 'syn-20260729T203006Z-a1b2c3d4'

    try {
      const artifact = await createSyntheticSourcePdf({
        browserDirectory: directory,
        runId,
      })
      await rm(artifact.path)
      await writeFile(artifact.path, 'foreign-replacement')

      let failure: unknown
      try {
        await removeSyntheticSourcePdf(artifact, directory)
      } catch (error) {
        failure = error
      }
      expect(String(failure)).toBe(
        'Error: SYNTHETIC_SOURCE_PDF_REMOVE_INVALID',
      )
      expect(String(failure)).not.toContain(artifact.path)
      expect(await readFile(artifact.path, 'utf8')).toBe(
        'foreign-replacement',
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('does not delete a symlink swapped in before cleanup', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'task9-source-race-symlink-'),
    )
    const outsidePath = join(directory, 'outside.pdf')

    try {
      const artifact = await createSyntheticSourcePdf({
        browserDirectory: directory,
        runId: 'syn-20260729T203007Z-a1b2c3d4',
      })
      await rm(artifact.path)
      await writeFile(outsidePath, 'outside-target')
      await symlink(outsidePath, artifact.path)

      await expect(
        removeSyntheticSourcePdf(artifact, directory),
      ).rejects.toThrow('SYNTHETIC_SOURCE_PDF_REMOVE_INVALID')
      expect(await readFile(outsidePath, 'utf8')).toBe(
        'outside-target',
      )
      expect((await lstat(artifact.path)).isSymbolicLink()).toBe(
        true,
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('fails closed when cleanup is scoped to a different directory', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'task9-source-outside-'),
    )
    const otherDirectory = join(directory, 'other')

    try {
      await mkdir(otherDirectory)
      const artifact = await createSyntheticSourcePdf({
        browserDirectory: directory,
        runId: 'syn-20260729T203008Z-a1b2c3d4',
      })
      await expect(
        removeSyntheticSourcePdf(artifact, otherDirectory),
      ).rejects.toThrow('SYNTHETIC_SOURCE_PDF_REMOVE_INVALID')
      expect(await stat(artifact.path)).toBeDefined()
      await removeSyntheticSourcePdf(artifact, directory)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('removes its exclusive artifact and hides raw errors after a post-write failure', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'task9-source-post-write-'),
    )
    const runId = 'syn-20260729T203009Z-a1b2c3d4'
    const artifactId = '00000000-0000-4000-8000-000000000009'
    const artifactPath = join(
      directory,
      `task9-source-${runId}-${artifactId}.pdf`,
    )

    try {
      let failure: unknown
      try {
        await createSyntheticSourcePdf(
          { browserDirectory: directory, runId },
          {
            createArtifactId: () => artifactId,
            afterWrite: async () => {
              throw new Error(`RAW_FS_FAILURE ${artifactPath}`)
            },
          },
        )
      } catch (error) {
        failure = error
      }
      expect(String(failure)).toBe(
        'Error: SYNTHETIC_SOURCE_PDF_INVALID',
      )
      expect(String(failure)).not.toContain(directory)
      await expect(stat(artifactPath)).rejects.toMatchObject({
        code: 'ENOENT',
      })
      expect(
        (await readdir(directory)).filter((name) =>
          name.endsWith('.pdf'),
        ),
      ).toEqual([])
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
          currency: 'USD',
          modelId: 'claude-sonnet-4-6',
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
    maxUsd: 2,
    reservedUsd: 1,
    sourceReservationUsd: 0.25,
    forbiddenBIdentifiers: ['subject-b', 'marker-b'],
    pilotAccessModeConfirmed,
  }
}

function acceptedAreaFact(version: number) {
  return {
    id: factId,
    propertyProjectId: projectId,
    key: 'area.usable',
    label: 'Powierzchnia użytkowa',
    valueType: 'number',
    value: 83.4,
    unit: 'm²',
    status: 'confirmed',
    visibility: 'internal',
    confirmedByUserId: 'subject-a',
    sourceIds: [sourceId],
    version,
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
