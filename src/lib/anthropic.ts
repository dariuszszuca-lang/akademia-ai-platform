import Anthropic from '@anthropic-ai/sdk'

const apiKey = process.env.ANTHROPIC_API_KEY

if (!apiKey) {
  console.warn('[anthropic] ANTHROPIC_API_KEY not set, LLM calls will fail')
}

export const anthropic = new Anthropic({ apiKey: apiKey ?? 'missing' })

export const DEFAULT_MODEL =
  process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'
