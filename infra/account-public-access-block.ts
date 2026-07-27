export const EXPECTED_AWS_ACCOUNT = '261965598943'
export const EXPECTED_AWS_REGION = 'eu-central-1'

export const REQUIRED_PUBLIC_ACCESS_BLOCK = {
  BlockPublicAcls: true,
  IgnorePublicAcls: true,
  BlockPublicPolicy: true,
  RestrictPublicBuckets: true,
} as const

export type PublicAccessBlock = {
  BlockPublicAcls: boolean
  IgnorePublicAcls: boolean
  BlockPublicPolicy: boolean
  RestrictPublicBuckets: boolean
}

export interface AwsCliRunner {
  run(args: string[]): string
}

type EnableOptions = {
  profile?: string
  region?: string
}

export function enableAccountPublicAccessBlock(
  cli: AwsCliRunner,
  options: EnableOptions = {},
): PublicAccessBlock {
  const profile = options.profile ?? 'akademia-ai'
  const region = options.region ?? EXPECTED_AWS_REGION

  if (region !== EXPECTED_AWS_REGION) {
    throw new Error(`Refusing region ${region}`)
  }

  const identity = parseIdentity(
    cli.run([
      'sts',
      'get-caller-identity',
      '--profile',
      profile,
      '--region',
      region,
      '--output',
      'json',
    ]),
  )

  if (identity.Account !== EXPECTED_AWS_ACCOUNT) {
    throw new Error(`Refusing account ${identity.Account}`)
  }

  readPublicAccessBlock(cli, profile, region, true)

  cli.run([
    's3control',
    'put-public-access-block',
    '--profile',
    profile,
    '--region',
    region,
    '--account-id',
    EXPECTED_AWS_ACCOUNT,
    '--public-access-block-configuration',
    [
      'BlockPublicAcls=true',
      'IgnorePublicAcls=true',
      'BlockPublicPolicy=true',
      'RestrictPublicBuckets=true',
    ].join(','),
  ])

  const after = readPublicAccessBlock(cli, profile, region, false)
  if (!after || !isRequiredPublicAccessBlock(after)) {
    throw new Error('Account public access block verification failed')
  }

  return after
}

function parseIdentity(value: string): { Account: string } {
  const parsed: unknown = JSON.parse(value)
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('Account' in parsed) ||
    typeof parsed.Account !== 'string'
  ) {
    throw new Error('Invalid AWS caller identity response')
  }
  return { Account: parsed.Account }
}

function readPublicAccessBlock(
  cli: AwsCliRunner,
  profile: string,
  region: string,
  allowMissing: boolean,
): PublicAccessBlock | null {
  try {
    const raw = cli.run([
      's3control',
      'get-public-access-block',
      '--profile',
      profile,
      '--region',
      region,
      '--account-id',
      EXPECTED_AWS_ACCOUNT,
      '--output',
      'json',
    ])
    return parsePublicAccessBlock(raw)
  } catch (error) {
    if (
      allowMissing &&
      error instanceof Error &&
      error.message.includes('NoSuchPublicAccessBlockConfiguration')
    ) {
      return null
    }
    throw error
  }
}

function parsePublicAccessBlock(value: string): PublicAccessBlock {
  const parsed: unknown = JSON.parse(value)
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('PublicAccessBlockConfiguration' in parsed)
  ) {
    throw new Error('Invalid S3 public access block response')
  }

  const configuration = parsed.PublicAccessBlockConfiguration
  if (
    !configuration ||
    typeof configuration !== 'object' ||
    !('BlockPublicAcls' in configuration) ||
    !('IgnorePublicAcls' in configuration) ||
    !('BlockPublicPolicy' in configuration) ||
    !('RestrictPublicBuckets' in configuration) ||
    typeof configuration.BlockPublicAcls !== 'boolean' ||
    typeof configuration.IgnorePublicAcls !== 'boolean' ||
    typeof configuration.BlockPublicPolicy !== 'boolean' ||
    typeof configuration.RestrictPublicBuckets !== 'boolean'
  ) {
    throw new Error('Invalid S3 public access block response')
  }

  return {
    BlockPublicAcls: configuration.BlockPublicAcls,
    IgnorePublicAcls: configuration.IgnorePublicAcls,
    BlockPublicPolicy: configuration.BlockPublicPolicy,
    RestrictPublicBuckets: configuration.RestrictPublicBuckets,
  }
}

function isRequiredPublicAccessBlock(
  value: PublicAccessBlock,
): boolean {
  return Object.entries(REQUIRED_PUBLIC_ACCESS_BLOCK).every(
    ([key, expected]) =>
      value[key as keyof PublicAccessBlock] === expected,
  )
}
