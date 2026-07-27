import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/property-sources/server-repository', () => ({
  getPropertySourceCallbackService: vi.fn(),
}))

vi.mock('@/features/property-sources/callback-config', () => ({
  readPropertySourceCallbackConfig: vi.fn(() => ({
    secret: 'x'.repeat(32),
  })),
}))

describe('property source callback routes', () => {
  it('exposes only dynamic Node.js POST handlers', async () => {
    const contextRoute = await import(
      '@/app/api/internal/property-sources/context/route'
    )
    const resultRoute = await import(
      '@/app/api/internal/property-sources/result/route'
    )

    expect(contextRoute.runtime).toBe('nodejs')
    expect(contextRoute.dynamic).toBe('force-dynamic')
    expect(contextRoute.POST).toBeTypeOf('function')
    expect(contextRoute).not.toHaveProperty('GET')
    expect(resultRoute.runtime).toBe('nodejs')
    expect(resultRoute.dynamic).toBe('force-dynamic')
    expect(resultRoute.POST).toBeTypeOf('function')
    expect(resultRoute).not.toHaveProperty('GET')
  })
})
