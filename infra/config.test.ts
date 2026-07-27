import { describe, expect, it } from 'vitest'
import {
  parseInfrastructureConfig,
  readInfrastructureConfigFromEnv,
} from './config'

const devConfig = {
  studioEnv: 'dev',
  region: 'eu-central-1',
  account: '111122223333',
  vercelTeamSlug: 'ai-team',
  vercelProjectNames: ['akademia-ai-platform'],
  vercelEnvironments: ['development', 'preview'],
  studioCallbackBaseUrl: 'https://akademia-ai-platform.vercel.app',
  billingAlertEmail: 'alerts@example.com',
}

describe('AWS infrastructure configuration', () => {
  it('builds exact OIDC subjects for every project and environment', () => {
    const config = parseInfrastructureConfig({
      ...devConfig,
      vercelProjectNames: [
        'akademia-ai-platform',
        'property-intelligence-studio',
      ],
    })

    expect(config.vercelSubjects).toEqual([
      'owner:ai-team:project:akademia-ai-platform:environment:development',
      'owner:ai-team:project:akademia-ai-platform:environment:preview',
      'owner:ai-team:project:property-intelligence-studio:environment:development',
      'owner:ai-team:project:property-intelligence-studio:environment:preview',
    ])
  })

  it.each([
    { ...devConfig, studioEnv: 'stage' },
    { ...devConfig, region: 'us-east-1' },
    { ...devConfig, account: '123' },
    { ...devConfig, vercelTeamSlug: 'ai-*' },
    { ...devConfig, vercelProjectNames: ['*'] },
    { ...devConfig, vercelEnvironments: ['production'] },
    { ...devConfig, studioCallbackBaseUrl: 'http://localhost:3000' },
    {
      ...devConfig,
      studioCallbackBaseUrl:
        'https://akademia-ai-platform.vercel.app/unexpected-path',
    },
  ])('rejects unsafe development config: %j', (input) => {
    expect(() => parseInfrastructureConfig(input)).toThrow()
  })

  it('permits only the production Vercel environment in production', () => {
    expect(
      parseInfrastructureConfig({
        ...devConfig,
        studioEnv: 'prod',
        vercelEnvironments: ['production'],
      }).vercelEnvironments,
    ).toEqual(['production'])

    expect(() =>
      parseInfrastructureConfig({
        ...devConfig,
        studioEnv: 'prod',
        vercelEnvironments: ['production', 'preview'],
      }),
    ).toThrow()
  })

  it('requires a budget notification email in production', () => {
    expect(() =>
      parseInfrastructureConfig({
        ...devConfig,
        studioEnv: 'prod',
        vercelEnvironments: ['production'],
        billingAlertEmail: undefined,
      }),
    ).toThrow('billingAlertEmail')
  })

  it('accepts an existing team-scoped OIDC provider ARN', () => {
    expect(
      parseInfrastructureConfig({
        ...devConfig,
        oidcProviderArn:
          'arn:aws:iam::111122223333:oidc-provider/oidc.vercel.com/ai-team',
      }).oidcProviderArn,
    ).toBe(
      'arn:aws:iam::111122223333:oidc-provider/oidc.vercel.com/ai-team',
    )
  })

  it('rejects malformed or cross-account provider ARNs', () => {
    expect(() =>
      parseInfrastructureConfig({
        ...devConfig,
        oidcProviderArn:
          'arn:aws:iam::999900001111:oidc-provider/oidc.vercel.com/ai-team',
      }),
    ).toThrow('oidcProviderArn')
  })

  it('reads explicit OIDC environments from synthesis variables', () => {
    expect(
      readInfrastructureConfigFromEnv({
        STUDIO_ENV: 'dev',
        CDK_DEFAULT_ACCOUNT: '111122223333',
        CDK_DEFAULT_REGION: 'eu-central-1',
        VERCEL_TEAM_SLUG: 'ai-team',
        VERCEL_PROJECT_NAMES: 'akademia-ai-platform',
        VERCEL_OIDC_ENVIRONMENTS: 'development,preview',
        STUDIO_CALLBACK_BASE_URL:
          'https://akademia-ai-platform.vercel.app',
        BILLING_ALERT_EMAIL: 'alerts@example.com',
      }),
    ).toMatchObject({
      vercelEnvironments: ['development', 'preview'],
      studioCallbackBaseUrl:
        'https://akademia-ai-platform.vercel.app',
      pipelineVersion: 'property-source-v1',
    })
  })

  it('accepts only an exact callback secret ARN in the selected account and region', () => {
    const callbackSecretArn =
      'arn:aws:secretsmanager:eu-central-1:111122223333:secret:property-studio/dev/source-callback-AbCd12'

    expect(
      parseInfrastructureConfig({
        ...devConfig,
        callbackSecretArn,
      }).callbackSecretArn,
    ).toBe(callbackSecretArn)
    expect(() =>
      parseInfrastructureConfig({
        ...devConfig,
        callbackSecretArn:
          'arn:aws:secretsmanager:us-east-1:999900001111:secret:other',
      }),
    ).toThrow('callbackSecretArn')
  })
})
