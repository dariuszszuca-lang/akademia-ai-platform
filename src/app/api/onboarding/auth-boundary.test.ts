import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveApiUser: vi.fn(),
  markOnboardingComplete: vi.fn(),
  getOnboardingState: vi.fn(),
  getProfilMd: vi.fn(),
  saveExtendedProfilMd: vi.fn(),
  saveProfilMd: vi.fn(),
  savePersonaAnswer: vi.fn(),
  savePersonaMd: vi.fn(),
  setPersonaChosenType: vi.fn(),
  setPersonaPath: vi.fn(),
  saveExpressAnswer: vi.fn(),
  saveDeepAnswer: vi.fn(),
  storeDelete: vi.fn(),
  getEffectivePlan: vi.fn(),
  anthropicCreate: vi.fn(),
  anthropicStream: vi.fn(),
}))

vi.mock('@/lib/request-auth', () => ({
  resolveApiUser: mocks.resolveApiUser,
}))

vi.mock('@/lib/onboarding/state', () => ({
  markOnboardingComplete: mocks.markOnboardingComplete,
  getOnboardingState: mocks.getOnboardingState,
  getProfilMd: mocks.getProfilMd,
  saveExtendedProfilMd: mocks.saveExtendedProfilMd,
  saveProfilMd: mocks.saveProfilMd,
  savePersonaAnswer: mocks.savePersonaAnswer,
  savePersonaMd: mocks.savePersonaMd,
  setPersonaChosenType: mocks.setPersonaChosenType,
  setPersonaPath: mocks.setPersonaPath,
  saveExpressAnswer: mocks.saveExpressAnswer,
  saveDeepAnswer: mocks.saveDeepAnswer,
}))

vi.mock('@/lib/store', () => ({
  storeDelete: mocks.storeDelete,
}))

vi.mock('@/lib/billing/state', () => ({
  getEffectivePlan: mocks.getEffectivePlan,
}))

vi.mock('@/lib/anthropic', () => ({
  anthropic: {
    messages: {
      create: mocks.anthropicCreate,
      stream: mocks.anthropicStream,
    },
  },
  DEFAULT_MODEL: 'test-model',
}))

type RouteModule = {
  GET?: () => Promise<Response>
  POST?: (request: Request) => Promise<Response>
}

type RouteCase = {
  name: string
  method: 'GET' | 'POST'
  load: () => Promise<RouteModule>
  body?: unknown
}

const routes: RouteCase[] = [
  {
    name: 'complete',
    method: 'POST',
    load: () => import('./complete/route'),
  },
  {
    name: 'generate-deep',
    method: 'POST',
    load: () => import('./generate-deep/route'),
  },
  {
    name: 'generate-profil',
    method: 'POST',
    load: () => import('./generate-profil/route'),
  },
  {
    name: 'persona/answer',
    method: 'POST',
    load: () => import('./persona/answer/route'),
    body: { type: 'buyer', questionId: 'q1', answer: 'answer' },
  },
  {
    name: 'persona/expand',
    method: 'POST',
    load: () => import('./persona/expand/route'),
    body: {
      type: 'buyer',
      chosenIndex: 1,
      chosenType: {
        name: 'Buyer',
        who: 'Who',
        problem: 'Problem',
        match: 'Match',
      },
    },
  },
  {
    name: 'persona/generate',
    method: 'POST',
    load: () => import('./persona/generate/route'),
    body: { type: 'buyer' },
  },
  {
    name: 'persona/path',
    method: 'POST',
    load: () => import('./persona/path/route'),
    body: { type: 'buyer', path: 'A' },
  },
  {
    name: 'persona/types',
    method: 'POST',
    load: () => import('./persona/types/route'),
    body: { type: 'buyer' },
  },
  {
    name: 'reset',
    method: 'POST',
    load: () => import('./reset/route'),
  },
  {
    name: 'save-answer',
    method: 'POST',
    load: () => import('./save-answer/route'),
    body: { questionId: 'q1', answer: 'answer' },
  },
  {
    name: 'save-deep-answer',
    method: 'POST',
    load: () => import('./save-deep-answer/route'),
    body: { questionId: 'q1', answer: 'answer' },
  },
  {
    name: 'state',
    method: 'GET',
    load: () => import('./state/route'),
  },
]

function unauthorized(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 })
}

function createRequest(body: unknown): {
  request: Request
  json: ReturnType<typeof vi.spyOn>
} {
  const request = new Request('https://example.test/api/onboarding', {
    method: 'POST',
    headers: {
      authorization: 'Bearer admin-test-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  })
  const json = vi.spyOn(request, 'json')
  return { request, json }
}

describe('onboarding API authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveApiUser.mockResolvedValue({
      ok: false,
      response: unauthorized(),
    })
  })

  it.each(routes)(
    'blocks $method /api/onboarding/$name before request parsing or downstream work',
    async ({ method, load, body }) => {
      const routeModule = await load()
      const handler =
        method === 'GET' ? routeModule.GET : routeModule.POST
      if (!handler) {
        throw new Error(`Missing ${method} handler`)
      }

      const { request, json } = createRequest(body)
      const response =
        method === 'GET'
          ? await (handler as () => Promise<Response>)()
          : await (handler as (request: Request) => Promise<Response>)(
              request,
            )

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toEqual({
        error: 'unauthorized',
      })
      expect(mocks.resolveApiUser).toHaveBeenCalledOnce()
      expect(json).not.toHaveBeenCalled()

      const downstream = Object.entries(mocks).filter(
        ([name]) => name !== 'resolveApiUser',
      )
      for (const [, dependency] of downstream) {
        expect(dependency).not.toHaveBeenCalled()
      }
    },
  )
})
