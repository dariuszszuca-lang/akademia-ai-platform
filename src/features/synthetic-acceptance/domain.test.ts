import { describe, expect, it } from 'vitest'
import {
  assertSyntheticDataPolicy,
  runIdSchema,
  syntheticCaseCodes,
  syntheticCorpusSchema,
  syntheticMaterialKinds,
} from './domain'

describe('synthetic acceptance corpus contract', () => {
  it('requires exactly five synthetic cases', () => {
    expect(() =>
      syntheticCorpusSchema.parse({
        version: 'synthetic-v1',
        cases: [],
      }),
    ).toThrow()
  })

  it('rejects content that resembles a Polish national identifier', () => {
    expect(() =>
      assertSyntheticDataPolicy(
        `Osoba Testowa, PESEL ${'9'.repeat(11)}`,
      ),
    ).toThrow('SYNTHETIC_DATA_POLICY_VIOLATION')
  })

  it.each([
    'agent@example.com',
    '+48 501 234 567',
    'GD1G/12345678/9',
    `AK${'IA'}1234567890EXAMPLE`,
    `sk_${'live'}_example`,
    `sk-${'ant'}-example`,
    '-----BEGIN PRIVATE KEY-----',
  ])('rejects forbidden synthetic content: %s', (value) => {
    expect(() => assertSyntheticDataPolicy(value)).toThrow(
      'SYNTHETIC_DATA_POLICY_VIOLATION',
    )
  })

  it.each(['password', 'secret', 'token'])(
    'rejects a forbidden field named %s',
    (fieldName) => {
      expect(() =>
        assertSyntheticDataPolicy({
          safe: {
            [fieldName]: 'synthetic-value',
          },
        }),
      ).toThrow('SYNTHETIC_DATA_POLICY_VIOLATION')
    },
  )

  it('accepts explicitly fictional, non-identifying content', () => {
    expect(() =>
      assertSyntheticDataPolicy({
        title: 'Syntetyczne mieszkanie A',
        city: 'Testowo',
        landRegister: 'SYNTHETIC-NOT-A-LAND-REGISTER',
      }),
    ).not.toThrow()
  })

  it('keeps case codes, material kinds and run identifiers closed', () => {
    expect(syntheticCaseCodes).toEqual([
      'SYN-M-01',
      'SYN-M-02',
      'SYN-D-01',
      'SYN-P-01',
      'SYN-P-02',
    ])
    expect(syntheticMaterialKinds).toEqual([
      'pdf',
      'jpeg',
      'png',
      'docx',
      'xlsx',
      'csv',
      'txt',
    ])
    expect(
      runIdSchema.parse('syn-20260728T194500Z-a1b2c3d4'),
    ).toBe('syn-20260728T194500Z-a1b2c3d4')
    expect(
      runIdSchema.safeParse('../production').success,
    ).toBe(false)
  })
})
