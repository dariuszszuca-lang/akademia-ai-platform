import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime'
import { z } from 'zod'
import { propertyTypes } from '../../src/features/properties/domain'
import {
  evidenceMapSchema,
  runStructuredProposalPass,
  type ProposalPassRequest,
} from '../../src/features/property-sources/pipeline/evidence-proposals'
import { calculateSonnet46CostMicrounits } from '../../src/features/property-sources/pipeline/provider-cost'

const boundedModelIdSchema = z
  .string()
  .regex(/^eu\.[A-Za-z0-9][A-Za-z0-9._:-]{1,238}$/)
const proposalEventSchema = z
  .object({
    sourceId: z.string().uuid(),
    attempt: z.number().int().positive().max(20),
    pipelineVersion: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/),
    context: z
      .object({
        jobId: z.string().uuid(),
        source: z
          .object({
            id: z.string().uuid(),
            checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .passthrough(),
        property: z
          .object({
            propertyType: z.enum(propertyTypes),
            transactionType: z.string().min(1).max(80),
          })
          .passthrough(),
      })
      .passthrough(),
    evidenceMap: evidenceMapSchema,
    modelMetrics: z
      .object({
        provider: z.literal('amazon-bedrock'),
        modelId: boundedModelIdSchema,
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
        durationMs: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
  })
  .passthrough()

type Converse = (
  input: ConverseCommandInput,
) => Promise<ConverseCommandOutput>

export function createBedrockProposalHandler({
  modelId: rawModelId,
  converse,
}: {
  modelId: string
  converse: Converse
}) {
  const modelId = boundedModelIdSchema.parse(rawModelId)

  return async (rawEvent: unknown) => {
    const event = proposalEventSchema.parse(rawEvent)
    let inputTokens = event.modelMetrics?.inputTokens ?? 0
    let outputTokens = event.modelMetrics?.outputTokens ?? 0
    let durationMs = event.modelMetrics?.durationMs ?? 0
    const outcome = await runStructuredProposalPass({
      propertyType: event.context.property.propertyType,
      evidenceMap: event.evidenceMap,
      invoke: async (request) => {
        const response = await converse(
          createProposalRequest(modelId, request),
        )
        inputTokens += response.usage?.inputTokens ?? 0
        outputTokens += response.usage?.outputTokens ?? 0
        durationMs += response.metrics?.latencyMs ?? 0
        const text = extractResponseText(response)
        try {
          return JSON.parse(text)
        } catch {
          return null
        }
      },
    })
    const common = {
      sourceId: event.sourceId,
      jobId: event.context.jobId,
      checksumSha256: event.context.source.checksumSha256,
      attempt: event.attempt,
      pipelineVersion: event.pipelineVersion,
      provider: 'amazon-bedrock' as const,
      modelId,
      inputTokens,
      outputTokens,
      durationMs,
      providerCostMicrounits: calculateSonnet46CostMicrounits({
        inputTokens,
        outputTokens,
      }),
      currency: 'USD' as const,
    }

    return {
      ...event,
      result:
        outcome.outcome === 'succeeded'
          ? {
              ...common,
              outcome: 'succeeded' as const,
              proposals: outcome.proposals,
            }
          : {
              ...common,
              outcome: 'needs_manual_review' as const,
              errorCode: outcome.errorCode,
            },
    }
  }
}

function createProposalRequest(
  modelId: string,
  request: ProposalPassRequest,
): ConverseCommandInput {
  return {
    modelId,
    system: [
      {
        text: [
          request.systemInstruction,
          'TRUSTED_CATALOG_JSON:',
          JSON.stringify(request.trustedCatalog),
        ].join('\n'),
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            text: [
              'UNTRUSTED_EVIDENCE_JSON:',
              request.untrustedEvidenceJson,
            ].join('\n'),
          },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0,
    },
    outputConfig: {
      textFormat: {
        type: 'json_schema',
        structure: {
          jsonSchema: {
            name: 'property_fact_proposals',
            description:
              'Evidence-backed property fact proposals only.',
            schema: JSON.stringify(proposalJsonSchema),
          },
        },
      },
    },
    requestMetadata: {
      component: 'property-source-proposals',
    },
  }
}

function extractResponseText(response: ConverseCommandOutput) {
  const content =
    response.output && 'message' in response.output
      ? response.output.message?.content ?? []
      : []
  return content
    .flatMap((block) =>
      'text' in block && block.text ? [block.text] : [],
    )
    .join('')
}

const proposalJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['proposals'],
  properties: {
    proposals: {
      type: 'array',
      maxItems: 200,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['factKey', 'value', 'confidence', 'evidenceId'],
        properties: {
          factKey: {
            type: 'string',
            pattern: '^[a-z][a-zA-Z0-9._-]*$',
            maxLength: 100,
          },
          value: {
            type: ['string', 'number', 'boolean', 'object', 'array', 'null'],
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          evidenceId: {
            type: 'string',
            pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$',
          },
        },
      },
    },
  },
} as const

let defaultHandler:
  | ReturnType<typeof createBedrockProposalHandler>
  | undefined

export async function handler(event: unknown) {
  defaultHandler ??= createBedrockProposalHandler({
    modelId: process.env.BEDROCK_MODEL_ID ?? '',
    converse: (input) =>
      new BedrockRuntimeClient({}).send(new ConverseCommand(input)),
  })
  return defaultHandler(event)
}
