export type PropertySourceCallbackConfig = {
  secret: string
}

export function readPropertySourceCallbackConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): PropertySourceCallbackConfig {
  const secret = environment.PROPERTY_SOURCE_CALLBACK_SECRET
  if (!secret) {
    throw new Error(
      'Missing runtime variable: PROPERTY_SOURCE_CALLBACK_SECRET',
    )
  }
  if (secret.length < 32) {
    throw new Error(
      'Invalid runtime variable: PROPERTY_SOURCE_CALLBACK_SECRET',
    )
  }

  return { secret }
}
