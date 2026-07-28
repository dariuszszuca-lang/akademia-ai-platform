import { z } from 'zod'

const requiredRuntimeVariables = [
  'AWS_REGION',
  'PROPERTY_SOURCE_BUCKET',
  'PROPERTY_SOURCE_KMS_KEY_ARN',
  'PROPERTY_SOURCE_SIGNER_ROLE_ARN',
  'PROPERTY_SOURCE_DELETION_ROLE_ARN',
] as const

const runtimeConfigSchema = z
  .object({
    AWS_REGION: z.literal('eu-central-1'),
    PROPERTY_SOURCE_BUCKET: z
      .string()
      .min(3)
      .max(63)
      .regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/)
      .refine((value) => !value.includes('..'))
      .refine((value) => !value.includes('.-') && !value.includes('-.'))
      .refine((value) => !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)),
    PROPERTY_SOURCE_KMS_KEY_ARN: z
      .string()
      .regex(
        /^arn:aws:kms:eu-central-1:\d{12}:key\/[A-Za-z0-9-]{8,}$/,
      ),
    PROPERTY_SOURCE_SIGNER_ROLE_ARN: z
      .string()
      .regex(/^arn:aws:iam::\d{12}:role\/[A-Za-z0-9+=,.@_/-]{1,512}$/),
    PROPERTY_SOURCE_DELETION_ROLE_ARN: z
      .string()
      .regex(/^arn:aws:iam::\d{12}:role\/[A-Za-z0-9+=,.@_/-]{1,512}$/),
  })
  .superRefine((config, context) => {
    const kmsAccount = config.PROPERTY_SOURCE_KMS_KEY_ARN.split(':')[4]
    const roleAccount =
      config.PROPERTY_SOURCE_SIGNER_ROLE_ARN.split(':')[4]
    const deletionRoleAccount =
      config.PROPERTY_SOURCE_DELETION_ROLE_ARN.split(':')[4]

    if (kmsAccount !== roleAccount) {
      context.addIssue({
        code: 'custom',
        path: ['PROPERTY_SOURCE_SIGNER_ROLE_ARN'],
        message: 'account mismatch',
      })
    }
    if (kmsAccount !== deletionRoleAccount) {
      context.addIssue({
        code: 'custom',
        path: ['PROPERTY_SOURCE_DELETION_ROLE_ARN'],
        message: 'account mismatch',
      })
    }
  })

export type AwsPropertySourceConfig = {
  region: 'eu-central-1'
  bucket: string
  kmsKeyArn: string
  signerRoleArn: string
  deletionRoleArn: string
}

export function readAwsPropertySourceConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AwsPropertySourceConfig {
  const normalizedEnvironment = Object.fromEntries(
    requiredRuntimeVariables.map((variableName) => [
      variableName,
      environment[variableName]?.trim(),
    ]),
  )

  for (const variableName of requiredRuntimeVariables) {
    if (!normalizedEnvironment[variableName]) {
      throw new Error(`Missing runtime variable: ${variableName}`)
    }
  }

  const result = runtimeConfigSchema.safeParse({
    AWS_REGION: normalizedEnvironment.AWS_REGION,
    PROPERTY_SOURCE_BUCKET:
      normalizedEnvironment.PROPERTY_SOURCE_BUCKET,
    PROPERTY_SOURCE_KMS_KEY_ARN:
      normalizedEnvironment.PROPERTY_SOURCE_KMS_KEY_ARN,
    PROPERTY_SOURCE_SIGNER_ROLE_ARN:
      normalizedEnvironment.PROPERTY_SOURCE_SIGNER_ROLE_ARN,
    PROPERTY_SOURCE_DELETION_ROLE_ARN:
      normalizedEnvironment.PROPERTY_SOURCE_DELETION_ROLE_ARN,
  })

  if (!result.success) {
    const variableName =
      result.error.issues[0]?.path[0] ?? 'AWS_PROPERTY_SOURCE_CONFIG'
    throw new Error(`Invalid runtime variable: ${String(variableName)}`)
  }

  return {
    region: result.data.AWS_REGION,
    bucket: result.data.PROPERTY_SOURCE_BUCKET,
    kmsKeyArn: result.data.PROPERTY_SOURCE_KMS_KEY_ARN,
    signerRoleArn: result.data.PROPERTY_SOURCE_SIGNER_ROLE_ARN,
    deletionRoleArn: result.data.PROPERTY_SOURCE_DELETION_ROLE_ARN,
  }
}
