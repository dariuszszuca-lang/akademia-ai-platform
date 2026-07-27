const HAIKU_45_INPUT_USD_MICROUNITS_PER_TOKEN = 1
const HAIKU_45_OUTPUT_USD_MICROUNITS_PER_TOKEN = 5

export function calculateHaiku45CostMicrounits({
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
    inputTokens * HAIKU_45_INPUT_USD_MICROUNITS_PER_TOKEN +
    outputTokens * HAIKU_45_OUTPUT_USD_MICROUNITS_PER_TOKEN
  if (!Number.isSafeInteger(microunits)) {
    throw new Error('INVALID_TOKEN_COUNT')
  }
  return microunits
}
