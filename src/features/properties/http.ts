import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import type { PropertyService } from './service'

type PropertyContext = {
  params: {
    propertyId: string
  }
}

type PropertyFactContext = {
  params: {
    propertyId: string
    factId: string
  }
}

type PropertyHttpDependencies = {
  getService: () => PropertyService
  getUserId: () => Promise<string | null>
}

class InvalidJsonError extends Error {}

export function createPropertyHttpHandlers({
  getService,
  getUserId,
}: PropertyHttpDependencies) {
  return {
    listProjects: () =>
      withAuthenticatedUser(getUserId, async (userId) =>
        NextResponse.json({
          projects: await getService().listProjects(userId),
        }),
      ),

    createProject: (request: Request) =>
      withAuthenticatedUser(getUserId, async (userId) => {
        const project = await getService().createProject(
          userId,
          await readJson(request),
        )
        return NextResponse.json({ project }, { status: 201 })
      }),

    getProject: (_request: Request, context: PropertyContext) =>
      withAuthenticatedUser(getUserId, async (userId) =>
        NextResponse.json({
          project: await getService().getProject(
            userId,
            context.params.propertyId,
          ),
        }),
      ),

    updateProject: (request: Request, context: PropertyContext) =>
      withAuthenticatedUser(getUserId, async (userId) =>
        NextResponse.json({
          project: await getService().updateProject(
            userId,
            context.params.propertyId,
            await readJson(request),
          ),
        }),
      ),

    listFacts: (_request: Request, context: PropertyContext) =>
      withAuthenticatedUser(getUserId, async (userId) =>
        NextResponse.json({
          facts: await getService().listFacts(
            userId,
            context.params.propertyId,
          ),
        }),
      ),

    createFact: (request: Request, context: PropertyContext) =>
      withAuthenticatedUser(getUserId, async (userId) => {
        const fact = await getService().createFact(
          userId,
          context.params.propertyId,
          await readJson(request),
        )
        return NextResponse.json({ fact }, { status: 201 })
      }),

    updateFact: (request: Request, context: PropertyFactContext) =>
      withAuthenticatedUser(getUserId, async (userId) =>
        NextResponse.json({
          fact: await getService().updateFact(
            userId,
            context.params.propertyId,
            context.params.factId,
            await readJson(request),
          ),
        }),
      ),
  }
}

async function withAuthenticatedUser(
  getUserId: PropertyHttpDependencies['getUserId'],
  action: (userId: string) => Promise<NextResponse>,
) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    return await action(userId)
  } catch (error) {
    return propertyErrorResponse(error)
  }
}

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new InvalidJsonError()
  }
}

export function propertyErrorResponse(error: unknown) {
  if (error instanceof InvalidJsonError) {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'validation_error', issues: error.issues },
      { status: 400 },
    )
  }

  if (error instanceof Error && error.message.endsWith('_NOT_FOUND')) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  console.error('[property-api] request_failed', {
    type: error instanceof Error ? error.name : 'unknown',
  })
  return NextResponse.json({ error: 'internal_error' }, { status: 500 })
}
