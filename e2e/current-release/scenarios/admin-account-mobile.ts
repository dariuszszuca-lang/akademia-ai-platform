import {
  expect,
  type Page,
} from '@playwright/test'
import { getUserSubject } from '../operator'
import {
  assertAccountExportSummary,
  assertRejectedAdminLogin,
  parseAdminAgentState,
  parseSafeDeletionResponse,
  summarizeAccountExport,
  type Task9Runtime,
  type Task9StudioState,
} from '../task9-helpers'

export type Task9BrowserUsage = {
  observedPipelineCostUsd: number
  modelIds: string[]
}

export async function runAdminAccountMobileScenarios(
  runtime: Task9Runtime,
  studio: Task9StudioState,
): Promise<Task9BrowserUsage> {
  let exportUsage: Task9BrowserUsage | null = null

  await runtime.runScenario(
    'admin.agent-toggle',
    'ADMIN_AGENT_TOGGLE_FAILED',
    async () => {
      await runAdminToggle(runtime)
    },
  )

  await runtime.runScenario(
    'account.export',
    'ACCOUNT_EXPORT_FAILED',
    async () => {
      const { pageA } = runtime
      await pageA.goto('/settings')
      await expect(
        pageA.getByRole('heading', { name: /Twoje konto/ }),
      ).toBeVisible()

      const responsePromise = pageA.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname ===
            '/api/account/export',
      )
      await pageA
        .getByRole('button', {
          name: 'Pobierz JSON',
          exact: true,
        })
        .click()
      const response = await responsePromise
      if (response.status() !== 200) {
        throw new Error('ACCOUNT_EXPORT_INVALID')
      }

      const payload = await readJson(
        response,
        'ACCOUNT_EXPORT_INVALID',
      )

      await pageA.goto('/settings/subscription')
      await expect(
        pageA.getByRole('heading', {
          name: 'Dostęp pilotażowy Pro',
          exact: true,
        }),
      ).toBeVisible()
      await expect(
        pageA.getByText('Aktywny', { exact: true }),
      ).toBeVisible()
      await expect(
        pageA.getByText(
          /Płatności są obecnie wyłączone\./,
        ),
      ).toBeVisible()

      const summary = summarizeAccountExport(payload, {
        subjectA: studio.subjectA,
        organizationId: studio.organizationId,
        projectId: studio.projectId,
        factId: studio.factId,
        sourceId: studio.sourceId,
        sourceJobId: studio.jobId,
        acceptedProposalId: studio.proposals.area.id,
        rejectedProposalId: studio.proposals.price.id,
        forbiddenBIdentifiers: [
          studio.subjectB,
          runtime.fixtures.userB,
          `synthetic-release-${runtime.fixtures.runId}-b`,
        ],
        pilotAccessModeConfirmed: true,
      })
      assertAccountExportSummary(summary)
      if (
        runtime.budget.snapshot().sourcePipelineCalls !== 1
      ) {
        throw new Error('STUDIO_SOURCE_PIPELINE_CALLS_INVALID')
      }
      exportUsage = {
        observedPipelineCostUsd:
          summary.observedPipelineCostUsd,
        modelIds: summary.modelIds,
      }
    },
  )

  await runtime.runScenario(
    'ui.mobile',
    'UI_MOBILE_FAILED',
    async () => {
      await runMobileChecks(runtime.pageA, studio)
    },
  )

  await runtime.runScenario(
    'account.delete',
    'ACCOUNT_DELETE_FAILED',
    async () => {
      await deleteAccountA(runtime)
      await deleteAccountB(runtime)
    },
  )

  return requireValue<Task9BrowserUsage>(
    exportUsage,
    'ACCOUNT_EXPORT_USAGE_NOT_AVAILABLE',
  )
}

async function runAdminToggle(
  runtime: Task9Runtime,
): Promise<void> {
  const { pageA, contextA } = runtime
  let originalEnabled: boolean | null = null

  try {
    await pageA.goto('/admin/login')
    const passwordInput = pageA.locator(
      'input[type="password"]',
    )
    const wrongPassword =
      runtime.fixtures.adminPassword ===
      'NotTheAdminPassword!2026'
        ? 'AnotherWrongAdminPassword!2026'
        : 'NotTheAdminPassword!2026'
    await passwordInput.fill(wrongPassword)
    const rejectedLoginPromise = pageA.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/admin/auth',
    )
    await pageA
      .getByRole('button', { name: 'Zaloguj', exact: true })
      .click()
    const rejectedLogin = await rejectedLoginPromise
    assertRejectedAdminLogin(
      rejectedLogin.status(),
      await readJson(
        rejectedLogin,
        'ADMIN_INVALID_PASSWORD_NOT_REJECTED',
      ),
    )
    await expect(
      pageA.getByText('Invalid password', { exact: true }),
    ).toBeVisible()

    await passwordInput.fill(runtime.fixtures.adminPassword)
    const loginPromise = pageA.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/admin/auth',
    )
    await pageA
      .getByRole('button', { name: 'Zaloguj', exact: true })
      .click()
    const login = await loginPromise
    if (login.status() !== 200) {
      throw new Error('ADMIN_LOGIN_FAILED')
    }
    await pageA.waitForURL((url) => url.pathname === '/admin')

    const current = await contextA.request.get('/api/admin/agents')
    originalEnabled = await readAdminAgentState(current)
    await runtime.recordAdminPreviousState(
      'publikacja',
      originalEnabled,
    )

    const row = pageA.getByText('Publikacja', {
      exact: true,
    }).locator(
      'xpath=ancestor::div[.//input[@type="checkbox"]][1]',
    )
    await expect(row).toHaveCount(1)
    const checkbox = row.locator('input[type="checkbox"]')
    await expect(checkbox).toHaveCount(1)
    if ((await checkbox.isChecked()) !== originalEnabled) {
      throw new Error('ADMIN_AGENT_STATE_INVALID')
    }

    const inverse = !originalEnabled
    const patchPromise = pageA.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        new URL(response.url()).pathname === '/api/admin/agents',
    )
    await checkbox.click()
    const patch = await patchPromise
    await assertAdminPatch(patch)
    await expect(checkbox).toBeChecked({ checked: inverse })

    await pageA.goto('/agent')
    const publicationLink = pageA.locator(
      'a[href="/agent/publikacja"]',
    )
    if (inverse) {
      await expect(publicationLink).toHaveCount(1)
      await expect(publicationLink).toBeVisible()
    } else {
      await expect(publicationLink).toHaveCount(0)
    }
  } finally {
    try {
      if (originalEnabled !== null) {
        const restore = await contextA.request.patch(
          '/api/admin/agents',
          {
            data: {
              id: 'publikacja',
              enabled: originalEnabled,
            },
          },
        )
        await assertAdminPatch(restore)
        const readBack = await contextA.request.get(
          '/api/admin/agents',
        )
        const restoredEnabled =
          await readAdminAgentState(readBack)
        if (restoredEnabled !== originalEnabled) {
          throw new Error('ADMIN_RESTORE_READBACK_FAILED')
        }
      }
    } finally {
      const logout = await contextA.request.post(
        '/api/admin/logout',
      )
      if (logout.status() !== 200) {
        throw new Error('ADMIN_LOGOUT_FAILED')
      }
      const status = await contextA.request.get(
        '/api/admin/status',
      )
      if (
        status.status() !== 200 ||
        !isExactAdminStatus(
          await readJson(status, 'ADMIN_LOGOUT_FAILED'),
        )
      ) {
        throw new Error('ADMIN_LOGOUT_FAILED')
      }
    }
  }
}

async function runMobileChecks(
  page: Page,
  studio: Task9StudioState,
): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 })

  const routes: Array<{
    path: string
    ready: () => Promise<void>
  }> = [
    {
      path: '/start',
      ready: () =>
        expect(
          page.getByRole('heading', {
            name: /Dowody, decyzje/,
          }),
        ).toBeVisible(),
    },
    {
      path: '/profil',
      ready: () =>
        expect(
          page.getByRole('heading', {
            name: /Tak Cię widzą/,
          }),
        ).toBeVisible(),
    },
    {
      path: '/agent',
      ready: () =>
        expect(
          page.getByRole('heading', {
            name: 'Dobierz specjalistę do zadania.',
            exact: true,
          }),
        ).toBeVisible(),
    },
    {
      path: '/nieruchomosci',
      ready: () =>
        expect(
          page.getByRole('heading', {
            name: /Teczki, którym/,
          }),
        ).toBeVisible(),
    },
    projectRoute(page, studio, 'facts', 'Fakty'),
    projectRoute(page, studio, 'sources', 'Źródła'),
    projectRoute(page, studio, 'issues', 'Braki'),
    projectRoute(page, studio, 'history', 'Historia'),
    {
      path: '/settings',
      ready: () =>
        expect(
          page.getByRole('heading', { name: /Twoje konto/ }),
        ).toBeVisible(),
    },
    {
      path: '/settings/subscription',
      ready: async () => {
        await expect(
          page.getByRole('heading', {
            name: 'Dostęp pilotażowy Pro',
            exact: true,
          }),
        ).toBeVisible()
        await expect(
          page.getByText('Aktywny', { exact: true }),
        ).toBeVisible()
      },
    },
  ]

  for (const route of routes) {
    await page.goto(route.path)
    await expect(
      page.getByText('Ładowanie Studio...', { exact: true }),
    ).toBeHidden()
    await route.ready()

    const fitsViewport = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        window.innerWidth,
    )
    if (!fitsViewport) {
      throw new Error('UI_MOBILE_HORIZONTAL_OVERFLOW')
    }

    const hasVisiblePrefixedError = await page
      .locator('body')
      .evaluate((body) =>
        [...body.querySelectorAll<HTMLElement>('*')].some(
          (element) => {
            const text = element.innerText.trim()
            if (!text.startsWith('[Błąd')) return false
            const style = window.getComputedStyle(element)
            return (
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              element.getClientRects().length > 0
            )
          },
        ),
      )
    if (
      hasVisiblePrefixedError ||
      (await page.locator('[role="alert"]:visible').count()) > 0
    ) {
      throw new Error('UI_MOBILE_VISIBLE_ERROR')
    }

    await page.evaluate(() => {
      const active = document.activeElement
      if (active instanceof HTMLElement) active.blur()
    })
    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('link', {
      name: 'Przejdź do treści',
      exact: true,
    })
    await expect(skipLink).toBeFocused()
    await expect(skipLink).toBeVisible()
    const box = await skipLink.boundingBox()
    if (!box || box.width <= 0 || box.height <= 0) {
      throw new Error('UI_MOBILE_SKIP_LINK_INVALID')
    }
    const focusIsVisible = await skipLink.evaluate((element) => {
      const style = window.getComputedStyle(element)
      return (
        style.outlineStyle !== 'none' ||
        style.boxShadow !== 'none'
      )
    })
    if (!focusIsVisible) {
      throw new Error('UI_MOBILE_SKIP_LINK_INVALID')
    }
  }
}

function projectRoute(
  page: Page,
  studio: Task9StudioState,
  view: 'facts' | 'sources' | 'issues' | 'history',
  tab: 'Fakty' | 'Źródła' | 'Braki' | 'Historia',
): { path: string; ready: () => Promise<void> } {
  const suffix = {
    facts: '',
    sources: '/zrodla',
    issues: '/braki',
    history: '/historia',
  }[view]
  return {
    path: `/nieruchomosci/${studio.projectId}${suffix}`,
    ready: async () => {
      await expect(
        page.getByRole('heading', {
          name: studio.title,
          exact: true,
        }),
      ).toBeVisible()
      await expect(
        page.locator('a[aria-current="page"]').getByText(tab, {
          exact: true,
        }),
      ).toBeVisible()
    },
  }
}

async function deleteAccountA(
  runtime: Task9Runtime,
): Promise<void> {
  const { pageA, contextA } = runtime
  await pageA.goto('/settings')
  await pageA
    .getByRole('button', { name: 'Usuń konto', exact: true })
    .click()
  const confirm = pageA.getByRole('button', {
    name: 'Potwierdź usunięcie',
    exact: true,
  })
  await expect(confirm).toBeVisible()
  await expect(
    pageA.getByRole('button', {
      name: '← Anuluj',
      exact: true,
    }),
  ).toBeVisible()

  const responsePromise = pageA.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/account/delete',
  )
  await confirm.click()
  const response = await responsePromise
  if (response.status() !== 200) {
    throw new Error('ACCOUNT_DELETE_A_FAILED')
  }
  const receipt = parseSafeDeletionResponse(
    await readJson(response, 'ACCOUNT_DELETE_A_FAILED'),
  )
  await runtime.recordDeletionReceipt('a', receipt)

  await pageA.waitForURL((url) => url.pathname === '/login')
  const oldSession = await contextA.request.get('/api/properties')
  if (oldSession.status() !== 401) {
    throw new Error('ACCOUNT_DELETE_A_SESSION_ACTIVE')
  }
  if (
    (await getUserSubject(
      runtime.operatorContext,
      runtime.fixtures.userA,
    )) !== null
  ) {
    throw new Error('ACCOUNT_DELETE_A_IDENTITY_PRESENT')
  }
}

async function deleteAccountB(
  runtime: Task9Runtime,
): Promise<void> {
  let accessToken: string | null = await runtime.pageB.evaluate(
    () => window.localStorage.getItem('accessToken'),
  )
  if (!accessToken) {
    throw new Error('ACCOUNT_DELETE_B_TOKEN_MISSING')
  }

  try {
    const response = await runtime.contextB.request.post(
      '/api/account/delete',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        data: { confirm: 'DELETE' },
      },
    )
    if (response.status() !== 200) {
      throw new Error('ACCOUNT_DELETE_B_FAILED')
    }
    const receipt = parseSafeDeletionResponse(
      await readJson(response, 'ACCOUNT_DELETE_B_FAILED'),
    )
    await runtime.recordDeletionReceipt('b', receipt)
  } finally {
    accessToken = null
  }

  const oldSession = await runtime.contextB.request.get(
    '/api/properties',
  )
  if (oldSession.status() !== 401) {
    throw new Error('ACCOUNT_DELETE_B_SESSION_ACTIVE')
  }
  if (
    (await getUserSubject(
      runtime.operatorContext,
      runtime.fixtures.userB,
    )) !== null
  ) {
    throw new Error('ACCOUNT_DELETE_B_IDENTITY_PRESENT')
  }
}

async function readAdminAgentState(
  response: ResponseLike,
): Promise<boolean> {
  if (response.status() !== 200) {
    throw new Error('ADMIN_AGENT_STATE_INVALID')
  }
  const payload = await readJson(
    response,
    'ADMIN_AGENT_STATE_INVALID',
  )
  return parseAdminAgentState(payload, 'publikacja').enabled
}

async function assertAdminPatch(
  response: ResponseLike,
): Promise<void> {
  if (response.status() !== 200) {
    throw new Error('ADMIN_AGENT_PATCH_FAILED')
  }
  const payload = await readJson(
    response,
    'ADMIN_AGENT_PATCH_FAILED',
  )
  if (
    !isRecord(payload) ||
    Object.keys(payload).length !== 1 ||
    payload.ok !== true
  ) {
    throw new Error('ADMIN_AGENT_PATCH_FAILED')
  }
}

function isExactAdminStatus(payload: unknown): boolean {
  return (
    isRecord(payload) &&
    Object.keys(payload).length === 1 &&
    payload.admin === false
  )
}

async function readJson(
  response: { json(): Promise<unknown> },
  errorCode: string,
): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new Error(errorCode)
  }
}

function requireValue<T>(
  value: T | null,
  errorCode: string,
): T {
  if (value === null) throw new Error(errorCode)
  return value
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

type ResponseLike = {
  status(): number
  json(): Promise<unknown>
}
