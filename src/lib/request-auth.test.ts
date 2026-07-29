import { describe, expect, it, vi } from 'vitest'
import { createApiUserResolver } from './request-auth'

describe('API user boundary', () => {
  it('returns 401 when the signed session is absent', async () => {
    const resolve = createApiUserResolver(async () => null)
    const result = await resolve()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      await expect(result.response.json()).resolves.toEqual({
        error: 'unauthorized',
      })
    }
  })

  it('returns only the verified session subject', async () => {
    const resolve = createApiUserResolver(
      vi.fn(async () => 'verified-user'),
    )

    await expect(resolve()).resolves.toEqual({
      ok: true,
      userId: 'verified-user',
    })
  })
})
