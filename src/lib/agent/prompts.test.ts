import { describe, expect, it } from 'vitest'
import { findAgent } from '@/data/agents'
import { buildAgentSystemPrompt } from './prompts'
import type { UserContext } from './user-context'

const emptyContext: UserContext = {
  profil: null,
  personaBuyer: null,
  personaSeller: null,
  hasAny: false,
}

describe('legal agent system prompt', () => {
  it('fails closed when retrieval returns no relevant legal chunks', () => {
    const legalAgent = findAgent('prawny')
    if (!legalAgent) throw new Error('Missing legal agent fixture')

    const prompt = buildAgentSystemPrompt(
      legalAgent,
      emptyContext,
      [],
    )

    expect(prompt).toContain(
      '(brak relewantnych fragmentów ustawowych)',
    )
    expect(prompt).toContain(
      'Bez relewantnych źródeł nie cytuj ani nie oznaczaj przepisów jako pewnych.',
    )
    expect(prompt).toContain(
      'Poinformuj o braku źródeł i poproś o dokument lub dodatkowy kontekst.',
    )
  })

  it('does not add the legal retrieval block to other agents', () => {
    const ceoAgent = findAgent('ceo')
    if (!ceoAgent) throw new Error('Missing CEO agent fixture')

    const prompt = buildAgentSystemPrompt(
      ceoAgent,
      emptyContext,
      [],
    )

    expect(prompt).not.toContain(
      '(brak relewantnych fragmentów ustawowych)',
    )
    expect(prompt).not.toContain(
      'Bez relewantnych źródeł nie cytuj ani nie oznaczaj przepisów jako pewnych.',
    )
  })
})
