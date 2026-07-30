import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import InviteRegisterPage from './page'

vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'akademia-ai-2026-edycja1' }),
  useRouter: () => ({ push: vi.fn() }),
}))

describe('InviteRegisterPage accessibility', () => {
  it('associates every registration label with its input', () => {
    const html = renderToStaticMarkup(<InviteRegisterPage />)

    expect(html).toContain('for="register-name"')
    expect(html).toContain('id="register-name"')
    expect(html).toContain('for="register-email"')
    expect(html).toContain('id="register-email"')
    expect(html).toContain('for="register-password"')
    expect(html).toContain('id="register-password"')
  })
})
