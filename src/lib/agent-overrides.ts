import { kv } from '@vercel/kv'
import { agents, type Agent } from '@/data/agents'

export type AgentOverride = { enabled: boolean }

const KV_KEY_PREFIX = 'module-override:'

function isKvConfigured() {
  return Boolean(
    process.env.KV_REST_API_URL &&
      (process.env.KV_REST_API_TOKEN ||
        process.env.KV_REST_API_READ_ONLY_TOKEN),
  )
}

export async function getAgentOverrides(): Promise<
  Record<string, AgentOverride>
> {
  if (!isKvConfigured()) return {}

  try {
    const ids = agents.map((agent) => `agent:${agent.id}`)
    const keys = ids.map((id) => `${KV_KEY_PREFIX}${id}`)
    const values = await kv.mget<Array<AgentOverride | null>>(...keys)

    const result: Record<string, AgentOverride> = {}
    ids.forEach((id, index) => {
      const value = values[index]
      if (value) result[id] = value
    })
    return result
  } catch (error) {
    console.error(
      '[agent-overrides] KV read failed, using defaults:',
      error,
    )
    return {}
  }
}

export async function setAgentOverride(
  agentId: string,
  override: AgentOverride,
) {
  if (!isKvConfigured()) {
    throw new Error('KV storage is not configured')
  }
  await kv.set(`${KV_KEY_PREFIX}agent:${agentId}`, override)
}

export function applyAgentOverrides<
  T extends { id: string; enabled: boolean },
>(list: T[], overrides: Record<string, AgentOverride>): T[] {
  return list.map((agent) => {
    const override = overrides[`agent:${agent.id}`]
    if (!override) return agent
    return { ...agent, enabled: override.enabled }
  })
}

export async function getEffectiveAgents(): Promise<Agent[]> {
  const overrides = await getAgentOverrides()
  return applyAgentOverrides(agents, overrides)
}

export function kvStatus() {
  return {
    configured: isKvConfigured(),
  }
}
