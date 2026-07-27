import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import type { PropertySourceService } from './service'
import { factProposalStatuses } from './domain'

type PropertyContext = {
  params: Promise<{
    propertyId: string
  }>
}

type ProposalContext = {
  params: Promise<{
    propertyId: string
    proposalId: string
  }>
}

type PropertySourceHttpDependencies = {
  getService: () => PropertySourceService
  getUserId: () => Promise<string | null>
}

const propertyParamsSchema = z.object({
  propertyId: z.string().uuid(),
})

const proposalParamsSchema = z.object({
  propertyId: z.string().uuid(),
  proposalId: z.string().uuid(),
})

const proposalStatusSchema = z.enum(factProposalStatuses)

class InvalidJsonError extends Error {}

export function createPropertySourceHttpHandlers({
  getService,
  getUserId,
}: PropertySourceHttpDependencies) {
  return {
    listSources: (_request: Request, context: PropertyContext) =>
      withAuthenticatedUser(getUserId, async (userId) => {
        const { propertyId } = propertyParamsSchema.parse(await context.params)
        return NextResponse.json({
          sources: await getService().listSources(userId, propertyId),
        })
      }),

    listProposals: (request: Request, context: PropertyContext) =>
      withAuthenticatedUser(getUserId, async (userId) => {
        const { propertyId } = propertyParamsSchema.parse(await context.params)
        const url = new URL(request.url)
        const statuses = url.searchParams
          .getAll('status')
          .flatMap((value) => value.split(','))
          .filter(Boolean)
          .map((status) => proposalStatusSchema.parse(status))
        const sourceId = url.searchParams.get('sourceId') ?? undefined

        return NextResponse.json({
          proposals: await getService().listProposals(userId, propertyId, {
            ...(statuses.length > 0 ? { statuses } : {}),
            ...(sourceId ? { sourceId } : {}),
          }),
        })
      }),

    decideProposal: (request: Request, context: ProposalContext) =>
      withAuthenticatedUser(getUserId, async (userId) => {
        const { propertyId, proposalId } = proposalParamsSchema.parse(
          await context.params,
        )
        const result = await getService().decideProposal(
          userId,
          propertyId,
          proposalId,
          await readJson(request),
        )

        return NextResponse.json(result)
      }),
  }
}

async function withAuthenticatedUser(
  getUserId: PropertySourceHttpDependencies['getUserId'],
  action: (userId: string) => Promise<NextResponse>,
) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    return await action(userId)
  } catch (error) {
    return propertySourceErrorResponse(error)
  }
}

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new InvalidJsonError()
  }
}

export function propertySourceErrorResponse(error: unknown) {
  if (error instanceof InvalidJsonError) {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'validation_error', issues: error.issues },
      { status: 400 },
    )
  }

  if (
    error instanceof Error &&
    [
      'PROPERTY_NOT_FOUND',
      'SOURCE_NOT_FOUND',
      'PROPOSAL_NOT_FOUND',
    ].includes(error.message)
  ) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (
    error instanceof Error &&
    [
      'PROPOSAL_ALREADY_DECIDED',
      'INVALID_PROPOSAL_DECISION',
      'PROPOSAL_CONFLICT_CHANGED',
    ].includes(error.message)
  ) {
    return NextResponse.json(
      { error: error.message.toLowerCase() },
      { status: 409 },
    )
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error('[property-source-api] request_failed', {
      type: error instanceof Error ? error.name : 'unknown',
    })
  }
  return NextResponse.json({ error: 'internal_error' }, { status: 500 })
}
