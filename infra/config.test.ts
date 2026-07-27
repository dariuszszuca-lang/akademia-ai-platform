import { describe, expect, it } from 'vitest'
import { parseInfrastructureConfig } from './config'

const devConfig = {
  studioEnv: 'dev',
  region: 'eu-central-1',
  account: '111122223333',
  vercelTeamSlug: 'ai-team',
  vercelProjectNames: ['akademia-ai-platform'],
  vercelEnvironments: ['development', 'preview'],
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
})
