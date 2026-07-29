import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import SettingsClient from './SettingsClient'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      email: 'pilot@example.com',
      name: 'Pilot',
      sub: 'synthetic-user-id',
    },
  }),
}))

describe('SettingsClient billing copy', () => {
  it('describes pilot access without subscription cancellation actions', () => {
    const html = renderToStaticMarkup(
      <SettingsClient billingMode="pilot" />,
    )

    expect(html).toContain(
      'Sprawdź funkcje aktywnego dostępu pilotażowego',
    )
    expect(html).not.toContain('anuluj')
  })

  it('preserves subscription management copy in Stripe mode', () => {
    const html = renderToStaticMarkup(
      <SettingsClient billingMode="stripe" />,
    )

    expect(html).toContain(
      'Zarządzaj subskrypcją, zmień plan, anuluj',
    )
  })
})
