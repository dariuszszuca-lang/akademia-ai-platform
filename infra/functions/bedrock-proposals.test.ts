import { describe, expect, it, vi } from 'vitest'
import { createBedrockProposalHandler } from './bedrock-proposals'

const baseEvent = {
  sourceId: '00000000-0000-4000-8000-000000000003',
  attempt: 1,
  pipelineVersion: 'property-source-v1',
  context: {
    jobId: '00000000-0000-4000-8000-000000000004',
    source: {
      id: '00000000-0000-4000-8000-000000000003',
      checksumSha256: 'a'.repeat(64),
    },
    property: {
      propertyType: 'apartment',
      transactionType: 'sale',
    },
  },
  evidenceMap: {
    evidence: [
      {
        id: 'evidence-1-1',
        text: 'Powierzchnia użytkowa: 83,4 m²',
        locator: { type: 'page' as const, page: 2 },
      },
    ],
  },
}

describe('Bedrock proposal builder worker', () => {
  it('uses structured output and builds an evidence-backed callback result', async () => {
    const converse = vi.fn().mockResolvedValue({
      output: {
        message: {
          role: 'assistant',
          content: [
            {
              text: JSON.stringify({
                proposals: [
                  {
                    factKey: 'area.usable',
                    value: 83.4,
                    confidence: 0.96,
                    evidenceId: 'evidence-1-1',
                  },
                ],
              }),
            },
          ],
        },
      },
      usage: { inputTokens: 200, outputTokens: 40 },
      metrics: { latencyMs: 220 },
    })
    const handler = createBedrockProposalHandler({
      modelId: 'eu.anthropic.claude-sonnet-4-6',
      converse,
    })

    const result = await handler({
      ...baseEvent,
      modelMetrics: {
        provider: 'amazon-bedrock',
        modelId:
          'eu.anthropic.claude-sonnet-4-6',
        inputTokens: 100,
        outputTokens: 20,
        durationMs: 480,
      },
    })

    expect(converse).toHaveBeenCalledOnce()
    expect(converse.mock.calls[0][0]).toMatchObject({
      outputConfig: {
        textFormat: {
          type: 'json_schema',
        },
      },
    })
    const proposalSchema =
      converse.mock.calls[0][0].outputConfig.textFormat.structure
        .jsonSchema.schema
    for (const unsupportedKeyword of [
      'maxItems',
      'minLength',
      'maxLength',
      'pattern',
      'minimum',
      'maximum',
    ]) {
      expect(proposalSchema).not.toContain(
        `"${unsupportedKeyword}"`,
      )
    }
    expect(result.result).toMatchObject({
      sourceId: baseEvent.sourceId,
      jobId: baseEvent.context.jobId,
      checksumSha256: baseEvent.context.source.checksumSha256,
      outcome: 'succeeded',
      provider: 'amazon-bedrock',
      providerCostMicrounits: 1800,
      durationMs: 700,
      proposals: [
        {
          factKey: 'area.usable',
          evidenceText: 'Powierzchnia użytkowa: 83,4 m²',
        },
      ],
    })
  })

  it('returns manual review after two invalid structured responses', async () => {
    const converse = vi.fn().mockResolvedValue({
      output: {
        message: {
          role: 'assistant',
          content: [{ text: JSON.stringify({ unexpected: true }) }],
        },
      },
    })
    const handler = createBedrockProposalHandler({
      modelId: 'eu.anthropic.claude-sonnet-4-6',
      converse,
    })

    const result = await handler(baseEvent)

    expect(converse).toHaveBeenCalledTimes(2)
    expect(result.result).toMatchObject({
      outcome: 'needs_manual_review',
      errorCode: 'STRUCTURED_OUTPUT_INVALID',
      provider: 'amazon-bedrock',
    })
  })

  it('skips Bedrock entirely when there is no cited evidence', async () => {
    const converse = vi.fn()
    const handler = createBedrockProposalHandler({
      modelId: 'eu.anthropic.claude-sonnet-4-6',
      converse,
    })

    const result = await handler({
      ...baseEvent,
      evidenceMap: { evidence: [] },
    })

    expect(converse).not.toHaveBeenCalled()
    expect(result.result).toMatchObject({
      outcome: 'succeeded',
      proposals: [],
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
    })
  })
})
