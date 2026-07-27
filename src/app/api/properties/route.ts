import { createPropertyHttpHandlers } from '@/features/properties/http'
import { getPropertyService } from '@/features/properties/server-repository'
import { getServerUserId } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handlers = createPropertyHttpHandlers({
  getService: getPropertyService,
  getUserId: getServerUserId,
})

export const GET = handlers.listProjects
export const POST = handlers.createProject
