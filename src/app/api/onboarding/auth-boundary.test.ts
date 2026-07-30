import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deepQuestions } from '@/data/onboarding/deep'
import { expressQuestions } from '@/data/onboarding/express'
import { getPersonaQuestions } from '@/data/onboarding/persona-questions'
import { AI_MODEL_ID_HEADER } from '@/lib/model-id'

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

const validPersonaTypes = {
  types: Array.from({ length: 3 }, (_, index) => ({
    name: `Synthetic type ${index + 1}`,
    who: `Synthetic audience ${index + 1}`,
    problem: `Synthetic problem ${index + 1}`,
    match: `Synthetic match ${index + 1}`,
  })),
}

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
  DEFAULT_MODEL: 'claude-test-model',
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

describe('onboarding model observability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveApiUser.mockResolvedValue({
      ok: true,
      userId: 'synthetic-user',
    })
    mocks.getProfilMd.mockResolvedValue('# synthetic profile')
    mocks.getEffectivePlan.mockResolvedValue({
      plan: 'pro',
      active: true,
    })
    mocks.getOnboardingState.mockResolvedValue({
      expressAnswers: Object.fromEntries(
        expressQuestions.map((question) => [
          question.id,
          'synthetic answer',
        ]),
      ),
      deepAnswers: Object.fromEntries(
        deepQuestions.map((question) => [
          question.id,
          'synthetic answer',
        ]),
      ),
      personaBuyer: {
        answers: Object.fromEntries(
          getPersonaQuestions('buyer').map((question) => [
            question.id,
            'synthetic answer',
          ]),
        ),
      },
      personaSeller: { answers: {} },
    })
    mocks.anthropicCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify(validPersonaTypes),
        },
      ],
    })
    mocks.anthropicStream.mockReturnValue(
      (async function* () {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'synthetic output' },
        }
      })(),
    )
  })

  it.each([
    {
      name: 'generate-profil',
      load: () => import('./generate-profil/route'),
      body: {},
    },
    {
      name: 'generate-deep',
      load: () => import('./generate-deep/route'),
      body: {},
    },
    {
      name: 'persona/types',
      load: () => import('./persona/types/route'),
      body: { type: 'buyer' },
    },
    {
      name: 'persona/expand',
      load: () => import('./persona/expand/route'),
      body: {
        type: 'buyer',
        chosenIndex: 1,
        chosenType: {
          name: 'Synthetic buyer',
          who: 'Synthetic audience',
          problem: 'Synthetic problem',
          match: 'Synthetic match',
        },
      },
    },
    {
      name: 'persona/generate',
      load: () => import('./persona/generate/route'),
      body: { type: 'buyer' },
    },
  ])(
    'exposes the configured safe model on successful $name responses',
    async ({ load, body }) => {
      const route = await load()
      const request = new Request(
        'https://example.test/api/onboarding',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      )

      const response = await route.POST(
        request as never,
      )
      await response.text()

      expect(response.status).toBe(200)
      expect(response.headers.get(AI_MODEL_ID_HEADER)).toBe(
        'claude-test-model',
      )
    },
  )

  it('requests a strict supported persona schema with a bounded provider call', async () => {
    const route = await import('./persona/types/route')
    const request = new Request(
      'https://example.test/api/onboarding/persona/types',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'buyer' }),
      },
    )

    const response = await route.POST(request)

    expect(response.status).toBe(200)
    const [parameters, requestOptions] =
      mocks.anthropicCreate.mock.calls[0]!
    expect(parameters.output_config).toMatchObject({
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['types'],
          properties: {
            types: {
              type: 'array',
              items: expect.any(Object),
              description: expect.stringContaining('maxItems: 3'),
            },
          },
        },
      },
    })
    expect(parameters.output_config.format.schema.properties.types)
      .not.toHaveProperty('minItems')
    expect(parameters.output_config.format.schema.properties.types)
      .not.toHaveProperty('maxItems')
    expect(requestOptions).toEqual({
      timeout: 25_000,
      maxRetries: 0,
    })
  })

  it('rejects unusable persona output without returning raw model text', async () => {
    mocks.anthropicCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            types: [
              {
                name: 'Only one type',
                who: 'Synthetic audience',
                problem: 'Synthetic problem',
                match: 'Synthetic match',
              },
            ],
          }),
        },
      ],
    })
    const route = await import('./persona/types/route')
    const request = new Request(
      'https://example.test/api/onboarding/persona/types',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'buyer' }),
      },
    )

    const response = await route.POST(request)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({ error: 'invalid AI response' })
    expect(JSON.stringify(body)).not.toContain('Only one type')
  })

  it('returns a stable error without exposing provider failures', async () => {
    mocks.anthropicCreate.mockRejectedValueOnce(
      new Error('provider request included sensitive diagnostics'),
    )
    const route = await import('./persona/types/route')
    const request = new Request(
      'https://example.test/api/onboarding/persona/types',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'seller' }),
      },
    )

    const response = await route.POST(request)
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({ error: 'AI service unavailable' })
    expect(JSON.stringify(body)).not.toContain('sensitive diagnostics')
  })
})
