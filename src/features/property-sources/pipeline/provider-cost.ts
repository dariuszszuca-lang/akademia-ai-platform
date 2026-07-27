const SONNET_46_INPUT_USD_MICROUNITS_PER_TOKEN = 3
const SONNET_46_OUTPUT_USD_MICROUNITS_PER_TOKEN = 15

export function calculateSonnet46CostMicrounits({
  inputTokens,
  outputTokens,
}: {
  inputTokens: number
  outputTokens: number
}) {
  if (
    !Number.isSafeInteger(inputTokens) ||
    !Number.isSafeInteger(outputTokens) ||
    inputTokens < 0 ||
    outputTokens < 0
  ) {
    throw new Error('INVALID_TOKEN_COUNT')
  }
  const microunits =
    inputTokens * SONNET_46_INPUT_USD_MICROUNITS_PER_TOKEN +
    outputTokens * SONNET_46_OUTPUT_USD_MICROUNITS_PER_TOKEN
  if (!Number.isSafeInteger(microunits)) {
    throw new Error('INVALID_TOKEN_COUNT')
  }
  return microunits
}
