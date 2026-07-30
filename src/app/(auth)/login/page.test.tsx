import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import LoginPage from './page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/auth-context', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({
    login: vi.fn(),
    error: null,
    clearError: vi.fn(),
  }),
}))

describe('LoginPage accessibility', () => {
  it('associates every login label with its input', () => {
    const html = renderToStaticMarkup(<LoginPage />)

    expect(html).toContain('for="login-email"')
    expect(html).toContain('id="login-email"')
    expect(html).toContain('for="login-password"')
    expect(html).toContain('id="login-password"')
  })
})
