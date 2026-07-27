import { z } from 'zod'

const safeIdentifier = z
  .string()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
    'must contain only letters, numbers, dots, underscores, and hyphens',
  )

const uniqueList = <T>(items: T[]) => new Set(items).size === items.length

const infrastructureConfigSchema = z
  .object({
    studioEnv: z.enum(['dev', 'prod']),
    region: z.literal('eu-central-1'),
    account: z.string().regex(/^\d{12}$/, 'must be a 12-digit AWS account'),
    vercelTeamSlug: safeIdentifier,
    vercelProjectNames: z
      .array(safeIdentifier)
      .min(1)
      .refine(uniqueList, 'must contain unique projects'),
    vercelEnvironments: z
      .array(z.enum(['development', 'preview', 'production']))
      .min(1)
      .refine(uniqueList, 'must contain unique environments'),
    billingAlertEmail: z.email().optional(),
    oidcProviderArn: z.string().optional(),
  })
  .superRefine((config, context) => {
    if (
      config.studioEnv === 'dev' &&
      config.vercelEnvironments.some(
        (environment) => environment === 'production',
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['vercelEnvironments'],
        message: 'development infrastructure cannot trust production',
      })
    }

    if (
      config.studioEnv === 'prod' &&
      (config.vercelEnvironments.length !== 1 ||
        config.vercelEnvironments[0] !== 'production')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['vercelEnvironments'],
        message: 'production infrastructure must trust only production',
      })
    }

    if (config.studioEnv === 'prod' && !config.billingAlertEmail) {
      context.addIssue({
        code: 'custom',
        path: ['billingAlertEmail'],
        message: 'billingAlertEmail is required in production',
      })
    }

    if (config.oidcProviderArn) {
      const expectedArn =
        `arn:aws:iam::${config.account}:oidc-provider/` +
        `oidc.vercel.com/${config.vercelTeamSlug}`

      if (config.oidcProviderArn !== expectedArn) {
        context.addIssue({
          code: 'custom',
          path: ['oidcProviderArn'],
          message: 'oidcProviderArn must match the configured account and team',
        })
      }
    }
  })

type ParsedInfrastructureConfig = z.infer<typeof infrastructureConfigSchema>

export type InfrastructureConfig = ParsedInfrastructureConfig & {
  vercelSubjects: string[]
}

export function parseInfrastructureConfig(
  input: unknown,
): InfrastructureConfig {
  const config = infrastructureConfigSchema.parse(input)
  const vercelSubjects = config.vercelProjectNames.flatMap((project) =>
    config.vercelEnvironments.map(
      (environment) =>
        `owner:${config.vercelTeamSlug}:project:${project}:environment:${environment}`,
    ),
  )

  return { ...config, vercelSubjects }
}

function splitCsv(value: string | undefined): string[] {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : []
}

export function readInfrastructureConfigFromEnv(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): InfrastructureConfig {
  return parseInfrastructureConfig({
    studioEnv: environment.STUDIO_ENV,
    region: environment.CDK_DEFAULT_REGION,
    account: environment.CDK_DEFAULT_ACCOUNT,
    vercelTeamSlug: environment.VERCEL_TEAM_SLUG,
    vercelProjectNames: splitCsv(environment.VERCEL_PROJECT_NAMES),
    vercelEnvironments: splitCsv(
      environment.VERCEL_OIDC_ENVIRONMENTS ??
        environment.VERCEL_ENVIRONMENTS,
    ),
    billingAlertEmail: environment.BILLING_ALERT_EMAIL || undefined,
    oidcProviderArn: environment.VERCEL_OIDC_PROVIDER_ARN || undefined,
  })
}
