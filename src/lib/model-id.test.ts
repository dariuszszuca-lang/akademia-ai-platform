import { describe, expect, it } from 'vitest'
import {
  AI_MODEL_ID_HEADER,
  observableModelHeaders,
  safeModelIdSchema,
} from './model-id'

describe('safe observable model identifiers', () => {
  it.each([
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
    'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
  ])('accepts and exposes safe model ID %s', (modelId) => {
    expect(safeModelIdSchema.parse(modelId)).toBe(modelId)
    expect(observableModelHeaders(modelId)).toEqual({
      [AI_MODEL_ID_HEADER]: modelId,
    })
  })

  it.each([
    '',
    'test-model',
    'claude model',
    'sk-ant-synthetic-marker',
    'claude-sonnet-4-6\nx-secret: marker',
    'eu.anthropic.claude-sonnet-4-6:latest',
    `claude-${'a'.repeat(241)}`,
  ])('does not reflect unsafe model ID %j', (modelId) => {
    expect(safeModelIdSchema.safeParse(modelId).success).toBe(false)
    expect(observableModelHeaders(modelId)).toEqual({})
  })
})
