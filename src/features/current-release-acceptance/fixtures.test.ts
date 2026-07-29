import { describe, expect, it } from 'vitest'
import { parseCurrentReleaseFixtures } from '../../../e2e/current-release/fixtures'

const runId = 'syn-20260729T220000Z-deadbeef'

function validEnvironment() {
  return {
    CURRENT_RELEASE_RUN_ID: runId,
    CURRENT_RELEASE_BASE_URL:
      'https://akademia-ai-platform.vercel.app',
    CURRENT_RELEASE_USER_A:
      `synthetic-release-${runId}-a@example.invalid`,
    CURRENT_RELEASE_USER_A_PASSWORD:
      'Synthetic-user-A-password-123!',
    CURRENT_RELEASE_USER_B:
      `synthetic-release-${runId}-b@example.invalid`,
    CURRENT_RELEASE_USER_B_PASSWORD:
      'Synthetic-user-B-password-456!',
    ADMIN_PASSWORD: 'Synthetic-admin-password-789!',
    AWS_PROFILE: 'akademia-ai',
    AWS_REGION: 'eu-central-1',
  }
}

describe('current release Playwright fixtures', () => {
  it('parses the exact synthetic production fixture set', () => {
    expect(parseCurrentReleaseFixtures(validEnvironment())).toEqual({
      runId,
      baseUrl: 'https://akademia-ai-platform.vercel.app',
      userA: `synthetic-release-${runId}-a@example.invalid`,
      passwordA: 'Synthetic-user-A-password-123!',
      userB: `synthetic-release-${runId}-b@example.invalid`,
      passwordB: 'Synthetic-user-B-password-456!',
      adminPassword: 'Synthetic-admin-password-789!',
      awsProfile: 'akademia-ai',
      awsRegion: 'eu-central-1',
    })
  })

  it.each([
    ['CURRENT_RELEASE_BASE_URL', 'http://akademia-ai-platform.vercel.app'],
    ['CURRENT_RELEASE_BASE_URL', 'https://akademia-ai-platform.vercel.app/'],
    ['CURRENT_RELEASE_USER_A', `synthetic-release-${runId}-b@example.invalid`],
    ['CURRENT_RELEASE_USER_B', `synthetic-release-${runId}-a@example.invalid`],
    ['CURRENT_RELEASE_USER_A_PASSWORD', 'weak'],
    ['CURRENT_RELEASE_USER_B_PASSWORD', 'alllowercasebutlongenough'],
    ['ADMIN_PASSWORD', '   '],
    ['AWS_PROFILE', 'ai-team'],
    ['AWS_REGION', 'us-east-1'],
  ])('rejects invalid %s', (key, value) => {
    expect(() =>
      parseCurrentReleaseFixtures({
        ...validEnvironment(),
        [key]: value,
      }),
    ).toThrow('CURRENT_RELEASE_FIXTURES_INVALID')
  })
})
