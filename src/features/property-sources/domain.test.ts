import { describe, expect, it } from 'vitest'
import {
  createPropertySourceSchema,
  evidenceLocatorSchema,
  ingestFactProposalSchema,
  proposalDecisionSchema,
} from './domain'

describe('property source domain', () => {
  it('accepts a page citation with a verbatim evidence fragment', () => {
    expect(
      ingestFactProposalSchema.parse({
        externalKey: 'area-usable-1',
        factKey: 'area.usable',
        label: 'Powierzchnia użytkowa',
        category: 'Powierzchnia',
        valueType: 'number',
        value: 83.4,
        unit: 'm²',
        confidence: 0.98,
        evidenceText: 'Powierzchnia użytkowa: 83,40 m²',
        evidenceLocator: { type: 'page', page: 2 },
      }),
    ).toMatchObject({ factKey: 'area.usable', confidence: 0.98 })
  })

  it.each([
    { type: 'page', page: 0 },
    { type: 'sheet', sheet: '', row: 1, column: 'A' },
    { type: 'time', startMs: 9000, endMs: 1000 },
    { type: 'text', start: 20, end: 10 },
  ])('rejects an invalid locator: %j', (locator) => {
    expect(() => evidenceLocatorSchema.parse(locator)).toThrow()
  })

  it('rejects a proposal without evidence text', () => {
    expect(() =>
      ingestFactProposalSchema.parse({
        externalKey: 'price-1',
        factKey: 'price.asking',
        label: 'Cena ofertowa',
        category: 'Cena',
        valueType: 'money',
        value: 925000,
        confidence: 0.8,
        evidenceText: '',
        evidenceLocator: { type: 'page', page: 1 },
      }),
    ).toThrow()
  })

  it('rejects proposal values that cannot be stored as JSON', () => {
    expect(() =>
      ingestFactProposalSchema.parse({
        externalKey: 'invalid-value',
        factKey: 'price.asking',
        label: 'Cena ofertowa',
        category: 'Cena',
        valueType: 'money',
        value: () => 925000,
        confidence: 0.8,
        evidenceText: 'Cena: 925 000 PLN',
        evidenceLocator: { type: 'page', page: 1 },
      }),
    ).toThrow()
  })

  it('does not accept actor, status or organization fields from source input', () => {
    const parsed = createPropertySourceSchema.parse({
      fileName: 'operat.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 1200,
      checksumSha256: 'a'.repeat(64),
      actorType: 'ai',
      status: 'review_ready',
      organizationId: 'forged-org',
    })

    expect(parsed).not.toHaveProperty('actorType')
    expect(parsed).not.toHaveProperty('status')
    expect(parsed).not.toHaveProperty('organizationId')
  })

  it('requires a corrected value for correct_and_accept', () => {
    expect(() =>
      proposalDecisionSchema.parse({ action: 'correct_and_accept' }),
    ).toThrow()
  })

  it('accepts all supported human decision actions', () => {
    expect(
      [
        { action: 'accept' },
        { action: 'correct_and_accept', value: 84 },
        { action: 'reject', note: 'Dokument nieaktualny' },
        { action: 'keep_existing' },
        { action: 'accept_new' },
        { action: 'keep_open', note: 'Potrzebna księga wieczysta' },
      ].map((decision) => proposalDecisionSchema.parse(decision).action),
    ).toEqual([
      'accept',
      'correct_and_accept',
      'reject',
      'keep_existing',
      'accept_new',
      'keep_open',
    ])
  })
})
