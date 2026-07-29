import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import SettingsClient, { deleteCurrentAccount } from './SettingsClient'

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

describe('SettingsClient account deletion', () => {
  it('requires a Cognito access token before sending a request', async () => {
    const request = vi.fn()
    const clearSession = vi.fn()
    const redirectToLogin = vi.fn()

    await expect(
      deleteCurrentAccount({
        readAccessToken: () => null,
        request,
        clearSession,
        redirectToLogin,
      }),
    ).rejects.toThrow('Sesja wygasła. Zaloguj się ponownie.')

    expect(request).not.toHaveBeenCalled()
    expect(clearSession).not.toHaveBeenCalled()
    expect(redirectToLogin).not.toHaveBeenCalled()
  })

  it('sends Bearer authorization and clears local session only after success', async () => {
    const order: string[] = []
    const request = vi.fn(async () => {
      order.push('request')
      return new Response(null, { status: 200 })
    })
    const clearSession = vi.fn(() => order.push('clear'))
    const redirectToLogin = vi.fn(() => order.push('redirect'))

    await deleteCurrentAccount({
      readAccessToken: () => 'access-token',
      request,
      clearSession,
      redirectToLogin,
    })

    expect(request).toHaveBeenCalledWith('/api/account/delete', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirm: 'DELETE' }),
    })
    expect(order).toEqual(['request', 'clear', 'redirect'])
  })

  it('preserves the local session when account deletion fails', async () => {
    const clearSession = vi.fn()
    const redirectToLogin = vi.fn()

    await expect(
      deleteCurrentAccount({
        readAccessToken: () => 'access-token',
        request: async () =>
          new Response(null, { status: 500 }),
        clearSession,
        redirectToLogin,
      }),
    ).rejects.toThrow('Usunięcie się nie powiodło')

    expect(clearSession).not.toHaveBeenCalled()
    expect(redirectToLogin).not.toHaveBeenCalled()
  })
})
