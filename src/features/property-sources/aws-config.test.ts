import { describe, expect, it } from 'vitest'
import { readAwsPropertySourceConfig } from './aws-config'

const validEnvironment = {
  AWS_REGION: 'eu-central-1',
  PROPERTY_SOURCE_BUCKET: 'property-studio-dev-111122223333',
  PROPERTY_SOURCE_KMS_KEY_ARN:
    'arn:aws:kms:eu-central-1:111122223333:key/12345678-1234-4234-8234-123456789012',
  PROPERTY_SOURCE_SIGNER_ROLE_ARN:
    'arn:aws:iam::111122223333:role/property-source-signer',
  PROPERTY_SOURCE_DELETION_ROLE_ARN:
    'arn:aws:iam::111122223333:role/property-source-deletion',
}

describe('AWS property source runtime configuration', () => {
  it.each([
    'AWS_REGION',
    'PROPERTY_SOURCE_BUCKET',
    'PROPERTY_SOURCE_KMS_KEY_ARN',
    'PROPERTY_SOURCE_SIGNER_ROLE_ARN',
    'PROPERTY_SOURCE_DELETION_ROLE_ARN',
  ])('fails safely when %s is missing', (variableName) => {
    const environment = { ...validEnvironment }
    delete environment[variableName as keyof typeof environment]

    expect(() => readAwsPropertySourceConfig(environment)).toThrow(
      `Missing runtime variable: ${variableName}`,
    )
  })

  it('requires the Frankfurt region', () => {
    expect(() =>
      readAwsPropertySourceConfig({
        ...validEnvironment,
        AWS_REGION: 'us-east-1',
      }),
    ).toThrow('Invalid runtime variable: AWS_REGION')
  })

  it('normalizes deployment transport whitespace around identifiers', () => {
    expect(
      readAwsPropertySourceConfig(
        Object.fromEntries(
          Object.entries(validEnvironment).map(([key, value]) => [
            key,
            `  ${value}\n`,
          ]),
        ),
      ),
    ).toEqual({
      region: 'eu-central-1',
      bucket: validEnvironment.PROPERTY_SOURCE_BUCKET,
      kmsKeyArn: validEnvironment.PROPERTY_SOURCE_KMS_KEY_ARN,
      signerRoleArn:
        validEnvironment.PROPERTY_SOURCE_SIGNER_ROLE_ARN,
      deletionRoleArn:
        validEnvironment.PROPERTY_SOURCE_DELETION_ROLE_ARN,
    })
  })

  it.each([
    {
      PROPERTY_SOURCE_BUCKET: 'Invalid_Bucket',
    },
    {
      PROPERTY_SOURCE_KMS_KEY_ARN:
        'arn:aws:kms:us-east-1:111122223333:key/key-id',
    },
    {
      PROPERTY_SOURCE_SIGNER_ROLE_ARN:
        'arn:aws:iam::999900001111:role/property-source-signer',
    },
    {
      PROPERTY_SOURCE_DELETION_ROLE_ARN:
        'arn:aws:iam::999900001111:role/property-source-deletion',
    },
  ])('rejects unsafe identifiers: %j', (overrides) => {
    expect(() =>
      readAwsPropertySourceConfig({
        ...validEnvironment,
        ...overrides,
      }),
    ).toThrow('Invalid runtime variable:')
  })

  it('never reads static AWS access-key variables', () => {
    const environment = new Proxy(validEnvironment, {
      get(target, property, receiver) {
        if (
          property === 'AWS_ACCESS_KEY_ID' ||
          property === 'AWS_SECRET_ACCESS_KEY'
        ) {
          throw new Error('Static credential variable was read')
        }
        return Reflect.get(target, property, receiver)
      },
    })

    expect(readAwsPropertySourceConfig(environment)).toMatchObject({
      region: 'eu-central-1',
      bucket: 'property-studio-dev-111122223333',
    })
  })
})
