import { z } from 'zod'

export const AI_MODEL_ID_HEADER = 'x-ai-model-id'

export const safeModelIdSchema = z
  .string()
  .trim()
  .max(240)
  .regex(
    /^(?:claude-[a-z0-9]+(?:-[a-z0-9]+)*|eu\.anthropic\.claude-[a-z0-9]+(?:-[a-z0-9]+)*(?::[0-9]+)?)$/,
    'CURRENT_RELEASE_MODEL_ID_INVALID',
  )

export function observableModelHeaders(
  modelId: string,
): Record<string, string> {
  const parsed = safeModelIdSchema.safeParse(modelId)
  return parsed.success
    ? { [AI_MODEL_ID_HEADER]: parsed.data }
    : {}
}
