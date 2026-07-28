import { describe, expect, it, vi } from 'vitest'
import { createBedrockEvidenceHandler } from './bedrock-evidence'

describe('Bedrock evidence mapper worker', () => {
  it('loads an S3 document and sends bytes when citations are enabled', async () => {
    const documentBytes = new Uint8Array([37, 80, 68, 70])
    const loadDocument = vi.fn().mockResolvedValue(documentBytes)
    const converse = vi.fn().mockResolvedValue({
      output: {
        message: {
          role: 'assistant',
          content: [],
        },
      },
    })
    const handler = createBedrockEvidenceHandler({
      modelId: 'eu.anthropic.claude-sonnet-4-6',
      converse,
      loadDocument,
    })
    const s3Uri =
      's3://property-studio-dev-sources/work/source/part-001.pdf'

    await handler({
      sourceId: '00000000-0000-4000-8000-000000000003',
      preparedParts: [
        {
          kind: 'document',
          format: 'pdf',
          s3Uri,
          pageOffset: 0,
        },
      ],
    })

    expect(loadDocument).toHaveBeenCalledWith(s3Uri)
    expect(
      converse.mock.calls[0][0].messages[0].content[1].document,
    ).toMatchObject({
      source: { bytes: documentBytes },
      citations: { enabled: true },
    })
    expect(
      converse.mock.calls[0][0].messages[0].content[1].document
        .source,
    ).not.toHaveProperty('s3Location')
  })

  it('maps only Bedrock citations to strict evidence locators', async () => {
    const converse = vi.fn().mockResolvedValue({
      output: {
        message: {
          role: 'assistant',
          content: [
            {
              citationsContent: {
                content: [{ text: 'Powierzchnia wynosi 83,4 m².' }],
                citations: [
                  {
                    sourceContent: [
                      { text: 'Powierzchnia użytkowa: 83,4 m²' },
                    ],
                    location: {
                      documentPage: { start: 1, end: 1 },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      usage: { inputTokens: 120, outputTokens: 30 },
      metrics: { latencyMs: 480 },
    })
    const handler = createBedrockEvidenceHandler({
      modelId: 'eu.anthropic.claude-sonnet-4-6',
      converse,
      loadDocument: vi
        .fn()
        .mockResolvedValue(new Uint8Array([37, 80, 68, 70])),
    })

    const result = await handler({
      sourceId: '00000000-0000-4000-8000-000000000003',
      preparedParts: [
        {
          kind: 'document',
          format: 'pdf',
          s3Uri:
            's3://property-studio-dev-sources/work/source/part-001.pdf',
          pageOffset: 20,
        },
      ],
    })

    expect(converse).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'eu.anthropic.claude-sonnet-4-6',
        inferenceConfig: {
          maxTokens: 2048,
          temperature: 0,
        },
      }),
    )
    const request = converse.mock.calls[0][0]
    expect(request.messages[0].content[1].document).toMatchObject({
      name: 'property-source',
      source: { bytes: expect.any(Uint8Array) },
      citations: { enabled: true },
    })
    expect(result).toMatchObject({
      evidenceMap: {
        evidence: [
          {
            id: 'evidence-1-1',
            text: 'Powierzchnia użytkowa: 83,4 m²',
            locator: { type: 'page', page: 22 },
          },
        ],
      },
      modelMetrics: {
        provider: 'amazon-bedrock',
        modelId: 'eu.anthropic.claude-sonnet-4-6',
        inputTokens: 120,
        outputTokens: 30,
        durationMs: 480,
      },
    })
  })

  it('returns no evidence when the model provides no valid citation', async () => {
    const handler = createBedrockEvidenceHandler({
      modelId: 'eu.anthropic.claude-sonnet-4-6',
      converse: vi.fn().mockResolvedValue({
        output: {
          message: { role: 'assistant', content: [{ text: 'uncited' }] },
        },
      }),
      loadDocument: vi
        .fn()
        .mockResolvedValue(new Uint8Array([117, 110, 99, 105, 116, 101, 100])),
    })

    await expect(
      handler({
        sourceId: '00000000-0000-4000-8000-000000000003',
        preparedParts: [
          {
            kind: 'document',
            format: 'txt',
            s3Uri: 's3://property-studio-dev-sources/work/source/part.txt',
            pageOffset: 0,
          },
        ],
      }),
    ).resolves.toMatchObject({ evidenceMap: { evidence: [] } })
  })

  it('maps character citations from prepared spreadsheets back to a cell', async () => {
    const handler = createBedrockEvidenceHandler({
      modelId: 'eu.anthropic.claude-sonnet-4-6',
      converse: vi.fn().mockResolvedValue({
        output: {
          message: {
            role: 'assistant',
            content: [
              {
                citationsContent: {
                  citations: [
                    {
                      sourceContent: [{ text: 'B2 750000' }],
                      location: {
                        documentChar: { start: 10, end: 19 },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      }),
      loadDocument: vi
        .fn()
        .mockResolvedValue(new Uint8Array([66, 50, 9, 55, 53, 48])),
    })

    const result = await handler({
      sourceId: '00000000-0000-4000-8000-000000000003',
      preparedParts: [
        {
          kind: 'document',
          format: 'txt',
          s3Uri:
            's3://property-studio-dev-sources/work/source/part.txt',
          pageOffset: 0,
          locatorMap: [
            {
              start: 10,
              end: 20,
              sheet: 'Oferta',
              row: 2,
              column: 'B',
            },
          ],
        },
      ],
    })

    expect('evidenceMap' in result).toBe(true)
    if (!('evidenceMap' in result)) throw new Error('expected evidence')
    expect(result.evidenceMap.evidence[0].locator).toEqual({
      type: 'sheet',
      sheet: 'Oferta',
      row: 2,
      column: 'B',
    })
  })

  it('extracts bounded visual evidence from an image with a page-one locator', async () => {
    const imageBytes = new Uint8Array([255, 216, 255, 224])
    const loadDocument = vi.fn().mockResolvedValue(imageBytes)
    const converse = vi.fn().mockResolvedValue({
      output: {
        message: {
          role: 'assistant',
          content: [
            {
              text: JSON.stringify({
                evidence: [
                  {
                    id: 'visible-1',
                    text: 'Cena ofertowa 750 000 zł',
                    locator: { type: 'page', page: 1 },
                  },
                ],
              }),
            },
          ],
        },
      },
      usage: { inputTokens: 50, outputTokens: 20 },
    })
    const handler = createBedrockEvidenceHandler({
      modelId: 'eu.anthropic.claude-sonnet-4-6',
      converse,
      loadDocument,
    })
    const s3Uri =
      's3://property-studio-dev-sources/originals/source/original'

    const result = await handler({
      sourceId: '00000000-0000-4000-8000-000000000003',
      preparedParts: [
        {
          kind: 'image',
          format: 'jpeg',
          s3Uri,
        },
      ],
    })

    expect(loadDocument).toHaveBeenCalledWith(s3Uri)
    const request = converse.mock.calls[0][0]
    expect(request.messages[0].content[1]).toMatchObject({
      image: {
        format: 'jpeg',
        source: { bytes: imageBytes },
      },
    })
    expect(
      request.messages[0].content[1].image.source,
    ).not.toHaveProperty('s3Location')
    expect(request.outputConfig.textFormat.type).toBe('json_schema')
    const visualEvidenceSchema =
      request.outputConfig.textFormat.structure.jsonSchema.schema
    for (const unsupportedKeyword of [
      'maxItems',
      'minLength',
      'maxLength',
      'pattern',
      'minimum',
      'maximum',
    ]) {
      expect(visualEvidenceSchema).not.toContain(
        `"${unsupportedKeyword}"`,
      )
    }
    expect('evidenceMap' in result).toBe(true)
    if (!('evidenceMap' in result)) throw new Error('expected evidence')
    expect(result.evidenceMap.evidence).toEqual([
      {
        id: 'evidence-1-1',
        text: 'Cena ofertowa 750 000 zł',
        locator: { type: 'page', page: 1 },
      },
    ])
  })

  it('routes two invalid visual responses to manual review', async () => {
    const converse = vi.fn().mockResolvedValue({
      output: {
        message: {
          role: 'assistant',
          content: [{ text: '{"unexpected":true}' }],
        },
      },
      metrics: { latencyMs: 60 },
    })
    const handler = createBedrockEvidenceHandler({
      modelId: 'eu.anthropic.claude-sonnet-4-6',
      converse,
      loadDocument: vi
        .fn()
        .mockResolvedValue(new Uint8Array([255, 216, 255, 224])),
    })

    const result = await handler({
      sourceId: '00000000-0000-4000-8000-000000000003',
      attempt: 1,
      pipelineVersion: 'property-source-v1',
      context: {
        jobId: '00000000-0000-4000-8000-000000000004',
        source: {
          checksumSha256: 'a'.repeat(64),
        },
      },
      preparedParts: [
        {
          kind: 'image',
          format: 'jpeg',
          s3Uri:
            's3://property-studio-dev-sources/originals/source/original',
        },
      ],
    })

    expect(converse).toHaveBeenCalledTimes(2)
    expect('result' in result).toBe(true)
    if (!('result' in result)) throw new Error('expected manual review')
    expect(result.result).toMatchObject({
      outcome: 'needs_manual_review',
      errorCode: 'STRUCTURED_OUTPUT_INVALID',
      provider: 'amazon-bedrock',
      durationMs: 120,
    })
  })
})
