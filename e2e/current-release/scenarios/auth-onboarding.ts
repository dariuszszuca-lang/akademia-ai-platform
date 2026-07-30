import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  type Response,
} from '@playwright/test'
import { deepQuestions } from '../../../src/data/onboarding/deep'
import { expressQuestions } from '../../../src/data/onboarding/express'
import { getPersonaQuestions } from '../../../src/data/onboarding/persona-questions'
import type { CurrentReleaseFixtures } from '../fixtures'
import {
  confirmUser,
  createUser,
  getUserSubject,
  type ResolvedOperatorContext,
} from '../operator'
import { createChildCostBudget } from '../budget'
import type { createCurrentReleaseJournal } from '../journal'
import {
  buildTask8BrowserHandoff,
  buildForeignUserMarkers,
  buildTask8ProfileMarker,
  collectObservableModelId,
  persistEphemeralStateBeforeRequest,
  syntheticAnswer,
  type Task8BrowserHandoff,
  type Task8EphemeralStateRuntime,
  type Task8NetworkLedger,
  type Task8ScenarioRunner,
} from '../ui-helpers'

export const onboardingGenerationPlan = [
  'a.express',
  'a.buyer.types',
  'a.buyer.expand',
  'a.seller.types',
  'a.seller.expand',
  'b.express',
  'b.buyer.generate',
  'b.seller.generate',
  'b.deep',
] as const

type CurrentReleaseJournal = ReturnType<
  typeof createCurrentReleaseJournal
>

export type Task8BrowserLifecycle = {
  contextA?: BrowserContext
  pageA?: Page
  contextB?: BrowserContext
  pageB?: Page
}

export type Task8AuthOnboardingRuntime = {
  browser: Browser
  fixtures: CurrentReleaseFixtures
  operatorContext: ResolvedOperatorContext
  budget: ReturnType<typeof createChildCostBudget>
  journal: CurrentReleaseJournal
  modelIds: Set<string>
  runScenario: Task8ScenarioRunner
  lifecycle: Task8BrowserLifecycle
  networkLedger: Task8NetworkLedger
  recordEphemeralStateExpiresAt(
    expiresAt: number,
  ): Promise<void>
}

type Task8AuthOnboardingInput = Omit<
  Task8AuthOnboardingRuntime,
  'recordEphemeralStateExpiresAt'
> &
  Partial<
    Pick<
      Task8AuthOnboardingRuntime,
      'recordEphemeralStateExpiresAt'
    >
  >

export async function runAuthOnboardingScenarios(
  input: Task8AuthOnboardingInput,
): Promise<Task8BrowserHandoff> {
  const runtime: Task8AuthOnboardingRuntime = {
    ...input,
    recordEphemeralStateExpiresAt:
      input.recordEphemeralStateExpiresAt ??
      ((expiresAt) =>
        input.journal.recordEphemeralStateExpiresAt(expiresAt)),
  }
  const ephemeralState: Task8EphemeralStateRuntime = {
    ephemeralStateExpiresAt: 1,
    recordEphemeralStateExpiresAt:
      runtime.recordEphemeralStateExpiresAt,
  }
  const userAProfileMarker = buildTask8ProfileMarker(
    runtime.fixtures.runId,
    'a',
  )
  const userBProfileMarker = buildTask8ProfileMarker(
    runtime.fixtures.runId,
    'b',
  )
  const contextA = await runtime.browser.newContext({
    baseURL: runtime.fixtures.baseUrl,
  })
  runtime.networkLedger.attach(contextA)
  const pageA = await contextA.newPage()
  runtime.lifecycle.contextA = contextA
  runtime.lifecycle.pageA = pageA

  let userASubject = ''
  let userBSubject = ''
  let contextB: BrowserContext | undefined
  let pageB: Page | undefined

  await runtime.runScenario(
    'auth.registration',
    'AUTH_REGISTRATION_FAILED',
    async () => {
      await pageA.goto('/register/invalid-synthetic')
      await expect(
        pageA.getByRole('heading', {
          name: 'Link nieprawidłowy',
          exact: true,
        }),
      ).toBeVisible()
      await expect(
        pageA.getByRole('button', { name: 'Zarejestruj się' }),
      ).toHaveCount(0)

      await pageA.goto('/register/akademia-ai-2026-edycja1')
      await pageA
        .getByLabel('Imię i nazwisko')
        .fill(`Agent syntetyczny ${runtime.fixtures.runId}`)
      await pageA
        .getByLabel('Email')
        .fill(runtime.fixtures.userA)
      await pageA
        .getByLabel('Hasło')
        .fill(runtime.fixtures.passwordA)
      await pageA
        .getByRole('button', { name: 'Zarejestruj się' })
        .click()
      await expect(
        pageA.getByRole('heading', {
          name: 'Sprawdź email',
          exact: true,
        }),
      ).toBeVisible()

      await confirmUser(
        runtime.operatorContext,
        runtime.fixtures.userA,
      )
      userASubject = requireSubject(
        await getUserSubject(
          runtime.operatorContext,
          runtime.fixtures.userA,
        ),
      )
      await recordUser(runtime, 'a', userASubject)
    },
  )

  await runtime.runScenario(
    'auth.session',
    'AUTH_SESSION_FAILED',
    async () => {
      await login(
        pageA,
        runtime.fixtures.userA,
        runtime.fixtures.passwordA,
      )
      await pageA.reload()
      await expectStartPage(pageA)

      const logoutResponse = waitForPostOrDelete(
        pageA,
        '/api/auth/session',
        'DELETE',
      )
      const menuButton = pageA.getByTitle(runtime.fixtures.userA)
      if ((await menuButton.count()) === 1) {
        await menuButton.click()
      } else {
        await pageA.locator('button[aria-haspopup="menu"]').click()
      }
      await pageA
        .getByRole('menuitem', {
          name: 'Wyloguj',
          exact: true,
        })
        .click()
      requireOk(await logoutResponse, 'AUTH_LOGOUT_FAILED')
      await pageA.waitForURL((url) => url.pathname === '/login')
      const protectedRead = await contextA.request.get(
        '/api/onboarding/state',
      )
      if (protectedRead.status() !== 401) {
        throw new Error('AUTH_PROTECTED_BOUNDARY_FAILED')
      }

      const wrongPasswordContext =
        await runtime.browser.newContext({
          baseURL: runtime.fixtures.baseUrl,
        })
      try {
        const wrongPasswordPage =
          await wrongPasswordContext.newPage()
        let sessionPostCount = 0
        wrongPasswordPage.on('request', (request) => {
          if (
            request.method() === 'POST' &&
            new URL(request.url()).pathname === '/api/auth/session'
          ) {
            sessionPostCount += 1
          }
        })
        await wrongPasswordPage.goto('/login')
        await wrongPasswordPage
          .getByLabel('Email')
          .fill(runtime.fixtures.userA)
        await wrongPasswordPage
          .getByLabel('Hasło')
          .fill(`${runtime.fixtures.passwordA}x`)
        await wrongPasswordPage
          .getByRole('button', {
            name: 'Zaloguj się',
            exact: true,
          })
          .click()
        await expect(
          wrongPasswordPage.getByText(
            'Nieprawidłowy email lub hasło',
            { exact: true },
          ),
        ).toBeVisible()
        if (sessionPostCount !== 0) {
          throw new Error('AUTH_WRONG_PASSWORD_SESSION_CREATED')
        }
      } finally {
        await wrongPasswordContext.close()
      }

      await login(
        pageA,
        runtime.fixtures.userA,
        runtime.fixtures.passwordA,
      )
    },
  )

  await runtime.runScenario(
    'onboarding.express',
    'ONBOARDING_EXPRESS_FAILED',
    async () => {
      await completeWizard({
        page: pageA,
        questions: expressQuestions,
        actor: 'a',
        runId: runtime.fixtures.runId,
        savePath: '/api/onboarding/save-answer',
        generationPath: '/api/onboarding/generate-profil',
        resultPath: '/onboarding/express/result',
        startPath: '/onboarding/express',
        budget: runtime.budget,
        modelIds: runtime.modelIds,
        ephemeralState,
      })
      await expect(
        pageA.getByText(userAProfileMarker, { exact: false }),
      ).toBeVisible()
      await assertProfileFiles(pageA, ['profil.md'])
    },
  )

  await runtime.runScenario(
    'onboarding.path-a',
    'ONBOARDING_PATH_A_FAILED',
    async () => {
      for (const type of ['buyer', 'seller'] as const) {
        await completePersonaPathA({
          page: pageA,
          type,
          budget: runtime.budget,
          modelIds: runtime.modelIds,
          ephemeralState,
        })
      }
      await assertProfileFiles(pageA, [
        'profil.md',
        'persona-kupujacy.md',
        'persona-sprzedajacy.md',
      ])
    },
  )

  await runtime.runScenario(
    'onboarding.path-b',
    'ONBOARDING_PATH_B_FAILED',
    async () => {
      await createUser(
        runtime.operatorContext,
        runtime.fixtures.userB,
        runtime.fixtures.passwordB,
      )
      userBSubject = requireSubject(
        await getUserSubject(
          runtime.operatorContext,
          runtime.fixtures.userB,
        ),
      )
      await recordUser(runtime, 'b', userBSubject)

      contextB = await runtime.browser.newContext({
        baseURL: runtime.fixtures.baseUrl,
      })
      runtime.networkLedger.attach(contextB)
      pageB = await contextB.newPage()
      runtime.lifecycle.contextB = contextB
      runtime.lifecycle.pageB = pageB
      await login(
        pageB,
        runtime.fixtures.userB,
        runtime.fixtures.passwordB,
      )
      await completeWizard({
        page: pageB,
        questions: expressQuestions,
        actor: 'b',
        runId: runtime.fixtures.runId,
        savePath: '/api/onboarding/save-answer',
        generationPath: '/api/onboarding/generate-profil',
        resultPath: '/onboarding/express/result',
        startPath: '/onboarding/express',
        budget: runtime.budget,
        modelIds: runtime.modelIds,
        ephemeralState,
      })
      await expect(
        pageB.getByText(userBProfileMarker, { exact: false }),
      ).toBeVisible()
      for (const type of ['buyer', 'seller'] as const) {
        await completePersonaPathB({
          page: pageB,
          type,
          runId: runtime.fixtures.runId,
          budget: runtime.budget,
          modelIds: runtime.modelIds,
          ephemeralState,
        })
      }
      await assertProfileFiles(pageB, [
        'profil.md',
        'persona-kupujacy.md',
        'persona-sprzedajacy.md',
      ])
    },
  )

  await runtime.runScenario(
    'onboarding.deep',
    'ONBOARDING_DEEP_FAILED',
    async () => {
      const activePageB = requirePage(pageB)
      await completeWizard({
        page: activePageB,
        questions: deepQuestions,
        actor: 'b',
        runId: runtime.fixtures.runId,
        savePath: '/api/onboarding/save-deep-answer',
        generationPath: '/api/onboarding/generate-deep',
        resultPath: '/onboarding/deep/result',
        startPath: '/onboarding/deep',
        budget: runtime.budget,
        modelIds: runtime.modelIds,
        ephemeralState,
      })
      const complete = await requireContext(contextB).request.post(
        '/api/onboarding/complete',
      )
      if (complete.status() !== 200) {
        throw new Error('ONBOARDING_COMPLETE_FAILED')
      }
      await assertProfileFiles(activePageB, [
        'profil.md',
        'persona-kupujacy.md',
        'persona-sprzedajacy.md',
      ])
      await assertPilotAccess(pageA)
      await assertPilotAccess(activePageB)
      await assertOnboardingIsolation(
        contextA,
        requireContext(contextB),
      )
    },
  )

  const snapshot = runtime.budget.snapshot()
  if (
    snapshot.onboardingGenerationCalls !== 9 ||
    snapshot.agentCalls !== 0 ||
    snapshot.sourcePipelineCalls !== 0 ||
    snapshot.reservedUsd !== 0.54
  ) {
    throw new Error('CURRENT_RELEASE_ONBOARDING_USAGE_INVALID')
  }

  return buildTask8BrowserHandoff({
    fixtures: runtime.fixtures,
    contextA,
    pageA,
    contextB: requireContext(contextB),
    pageB: requirePage(pageB),
    budget: runtime.budget,
    operatorContext: runtime.operatorContext,
    modelIds: runtime.modelIds,
    networkLedger: runtime.networkLedger,
    runScenario: runtime.runScenario,
    recordEphemeralStateExpiresAt:
      runtime.recordEphemeralStateExpiresAt,
    foreignUserMarkers: buildForeignUserMarkers({
      runId: runtime.fixtures.runId,
      userB: runtime.fixtures.userB,
      userBSubject: requireSubject(userBSubject),
    }),
    profileMarker: userAProfileMarker,
    ephemeralStateExpiresAt:
      ephemeralState.ephemeralStateExpiresAt,
    userASubject: requireSubject(userASubject),
    userBSubject: requireSubject(userBSubject),
  })
}

async function completeWizard(input: {
  page: Page
  questions: typeof expressQuestions | typeof deepQuestions
  actor: 'a' | 'b'
  runId: string
  savePath: string
  generationPath: string
  resultPath: string
  startPath: string
  budget: ReturnType<typeof createChildCostBudget>
  modelIds: Set<string>
  ephemeralState: Task8EphemeralStateRuntime
}): Promise<void> {
  await input.page.goto(input.startPath)

  for (const [index, question] of input.questions.entries()) {
    await expect(
      input.page.getByRole('heading', {
        name: question.prompt,
        exact: true,
      }),
    ).toBeVisible()
    const isLast = index === input.questions.length - 1

    if (question.type === 'select') {
      const saveResponse = waitForPost(
        input.page,
        input.savePath,
      )
      const option = question.options?.[0]
      if (!option) throw new Error('ONBOARDING_OPTION_MISSING')
      await input.page
        .getByRole('button', {
          name: option.label,
          exact: true,
        })
        .click()
      requireOk(
        await saveResponse,
        'ONBOARDING_SAVE_RESPONSE_INVALID',
      )
      if (isLast) {
        throw new Error('ONBOARDING_FINAL_SELECT_UNSUPPORTED')
      }
    } else {
      if (!question.placeholder) {
        throw new Error('ONBOARDING_PLACEHOLDER_MISSING')
      }
      await input.page
        .getByPlaceholder(question.placeholder, { exact: true })
        .fill(syntheticAnswer(input.runId, index, input.actor))
      const button = input.page.getByRole('button', {
        name: isLast ? 'Wygeneruj profil →' : 'Dalej →',
        exact: true,
      })
      if (isLast) {
        await input.budget.runBefore(
          'onboardingGeneration',
          () =>
            persistEphemeralStateBeforeRequest(
              input.ephemeralState,
              async () => {
                const saveResponse = waitForPost(
                  input.page,
                  input.savePath,
                )
                const generationResponse = waitForPost(
                  input.page,
                  input.generationPath,
                )
                await button.click()
                requireOk(
                  await saveResponse,
                  'ONBOARDING_SAVE_RESPONSE_INVALID',
                )
                const generated = await generationResponse
                requireOk(
                  generated,
                  'ONBOARDING_GENERATION_RESPONSE_INVALID',
                )
                collectObservableModelId(
                  generated.headers(),
                  input.modelIds,
                )
                await generated.finished()
              },
            ),
        )
      } else {
        const saveResponse = waitForPost(
          input.page,
          input.savePath,
        )
        await button.click()
        requireOk(
          await saveResponse,
          'ONBOARDING_SAVE_RESPONSE_INVALID',
        )
      }
    }

    if (!isLast) {
      await expect(
        input.page.getByRole('heading', {
          name: input.questions[index + 1]!.prompt,
          exact: true,
        }),
      ).toBeVisible()
    }
  }

  await input.page.waitForURL(
    (url) => url.pathname === input.resultPath,
  )
}

async function completePersonaPathA(input: {
  page: Page
  type: 'buyer' | 'seller'
  budget: ReturnType<typeof createChildCostBudget>
  modelIds: Set<string>
  ephemeralState: Task8EphemeralStateRuntime
}): Promise<void> {
  const basePath = `/onboarding/persona/${input.type}`
  await input.page.goto(basePath)
  await input.budget.runBefore(
    'onboardingGeneration',
    () =>
      persistEphemeralStateBeforeRequest(
        input.ephemeralState,
        async () => {
          const pathResponse = waitForPost(
            input.page,
            '/api/onboarding/persona/path',
          )
          const typesResponse = waitForPost(
            input.page,
            '/api/onboarding/persona/types',
          )
          await input.page
            .getByRole('button', {
              name: /Dopiero zaczynam, AI niech zaproponuje/,
            })
            .click()
          requireOk(
            await pathResponse,
            'ONBOARDING_PERSONA_PATH_INVALID',
          )
          const types = await typesResponse
          requireOk(types, 'ONBOARDING_PERSONA_TYPES_INVALID')
          collectObservableModelId(
            types.headers(),
            input.modelIds,
          )
          await types.finished()
        },
      ),
  )

  const choices = input.page
    .locator('button')
    .filter({ hasText: 'Wybierz →' })
  await expect(choices).toHaveCount(3)
  await input.budget.runBefore(
    'onboardingGeneration',
    () =>
      persistEphemeralStateBeforeRequest(
        input.ephemeralState,
        async () => {
          const expandResponse = waitForPost(
            input.page,
            '/api/onboarding/persona/expand',
          )
          await choices.first().click()
          const expanded = await expandResponse
          requireOk(
            expanded,
            'ONBOARDING_PERSONA_EXPAND_INVALID',
          )
          collectObservableModelId(
            expanded.headers(),
            input.modelIds,
          )
          await expanded.finished()
        },
      ),
  )
  await input.page.waitForURL(
    (url) => url.pathname === `${basePath}/result`,
  )
  await expect(
    input.page.getByText(
      input.type === 'buyer'
        ? /persona-kupujacy\.md/
        : /persona-sprzedajacy\.md/,
    ),
  ).toBeVisible()
}

async function completePersonaPathB(input: {
  page: Page
  type: 'buyer' | 'seller'
  runId: string
  budget: ReturnType<typeof createChildCostBudget>
  modelIds: Set<string>
  ephemeralState: Task8EphemeralStateRuntime
}): Promise<void> {
  const basePath = `/onboarding/persona/${input.type}`
  await input.page.goto(basePath)
  const pathResponse = waitForPost(
    input.page,
    '/api/onboarding/persona/path',
  )
  await input.page
    .getByRole('button', {
      name: /Znam swoich klientów/,
    })
    .click()
  requireOk(
    await pathResponse,
    'ONBOARDING_PERSONA_PATH_INVALID',
  )

  const questions = getPersonaQuestions(input.type)
  for (const [index, question] of questions.entries()) {
    await expect(
      input.page.getByText(question.prompt, { exact: true }),
    ).toBeVisible()
    const finalQuestion = index === questions.length - 1
    await input.page
      .getByPlaceholder(question.placeholder!, { exact: true })
      .fill(
        `SYN-B-${input.runId}-${input.type}-${index + 1}`,
      )

    if (finalQuestion) {
      await input.budget.runBefore(
        'onboardingGeneration',
        () =>
          persistEphemeralStateBeforeRequest(
            input.ephemeralState,
            async () => {
              const answerResponse = waitForPost(
                input.page,
                '/api/onboarding/persona/answer',
              )
              const generationResponse = waitForPost(
                input.page,
                '/api/onboarding/persona/generate',
              )
              await input.page
                .getByRole('button', {
                  name: 'Wyślij →',
                  exact: true,
                })
                .click()
              requireOk(
                await answerResponse,
                'ONBOARDING_PERSONA_ANSWER_INVALID',
              )
              const generated = await generationResponse
              requireOk(
                generated,
                'ONBOARDING_PERSONA_GENERATE_INVALID',
              )
              collectObservableModelId(
                generated.headers(),
                input.modelIds,
              )
              await generated.finished()
            },
          ),
      )
    } else {
      const answerResponse = waitForPost(
        input.page,
        '/api/onboarding/persona/answer',
      )
      await input.page
        .getByRole('button', {
          name: 'Wyślij →',
          exact: true,
        })
        .click()
      requireOk(
        await answerResponse,
        'ONBOARDING_PERSONA_ANSWER_INVALID',
      )
      await expect(
        input.page.getByText(questions[index + 1]!.prompt, {
          exact: true,
        }),
      ).toBeVisible()
    }
  }
  await input.page.waitForURL(
    (url) => url.pathname === `${basePath}/result`,
  )
}

async function login(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Hasło').fill(password)
  const sessionResponse = waitForPost(
    page,
    '/api/auth/session',
  )
  await page
    .getByRole('button', {
      name: 'Zaloguj się',
      exact: true,
    })
    .click()
  requireOk(await sessionResponse, 'AUTH_SESSION_FAILED')
  await page.waitForURL((url) => url.pathname === '/start')
  await expectStartPage(page)
}

async function expectStartPage(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: /Dowody, decyzje/ }),
  ).toBeVisible()
}

async function assertProfileFiles(
  page: Page,
  files: string[],
): Promise<void> {
  await page.goto('/profil')
  for (const file of files) {
    await expect(
      page.getByRole('button', {
        name: new RegExp(file.replace('.', '\\.')),
      }),
    ).toBeEnabled()
  }
}

async function assertPilotAccess(page: Page): Promise<void> {
  await page.goto('/settings/subscription')
  await expect(
    page.getByRole('heading', {
      name: 'Dostęp pilotażowy Pro',
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByText('Aktywny', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText(/Płatności są obecnie wyłączone\./),
  ).toBeVisible()
}

async function assertOnboardingIsolation(
  contextA: BrowserContext,
  contextB: BrowserContext,
): Promise<void> {
  const [responseA, responseB] = await Promise.all([
    contextA.request.get('/api/onboarding/state'),
    contextB.request.get('/api/onboarding/state'),
  ])
  if (responseA.status() !== 200 || responseB.status() !== 200) {
    throw new Error('ONBOARDING_ISOLATION_READ_FAILED')
  }
  const [bodyA, bodyB] = await Promise.all([
    responseA.text(),
    responseB.text(),
  ])
  if (
    !bodyA.includes('Syntetyczna odpowiedź A-') ||
    bodyA.includes('Syntetyczna odpowiedź B-') ||
    bodyA.includes('SYN-B-') ||
    !bodyB.includes('Syntetyczna odpowiedź B-') ||
    bodyB.includes('Syntetyczna odpowiedź A-')
  ) {
    throw new Error('ONBOARDING_CROSS_USER_LEAK')
  }
}

async function recordUser(
  runtime: Task8AuthOnboardingRuntime,
  role: 'a' | 'b',
  subject: string,
): Promise<void> {
  await runtime.journal.recordUserSubject(role, subject)
  for (const suffix of [
    'onboarding',
    'profil',
    'persona-buyer',
    'persona-seller',
    'subscription',
  ]) {
    await runtime.journal.recordKvKey(`user:${subject}:${suffix}`)
  }
}

function waitForPost(page: Page, pathname: string) {
  return waitForPostOrDelete(page, pathname, 'POST')
}

function waitForPostOrDelete(
  page: Page,
  pathname: string,
  method: 'POST' | 'DELETE',
) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      new URL(response.url()).pathname === pathname,
  )
}

function requireOk(response: Response, errorCode: string): void {
  if (!response.ok()) throw new Error(errorCode)
}

function requireSubject(subject: string | null): string {
  if (!subject) throw new Error('CURRENT_RELEASE_USER_SUBJECT_MISSING')
  return subject
}

function requireContext(
  context: BrowserContext | undefined,
): BrowserContext {
  if (!context) throw new Error('CURRENT_RELEASE_CONTEXT_MISSING')
  return context
}

function requirePage(page: Page | undefined): Page {
  if (!page) throw new Error('CURRENT_RELEASE_PAGE_MISSING')
  return page
}
