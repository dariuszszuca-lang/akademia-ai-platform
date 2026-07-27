import { readPropertySourceCallbackConfig } from '@/features/property-sources/callback-config'
import { createPropertySourceCallbackHttpHandlers } from '@/features/property-sources/callback-http'
import { getPropertySourceCallbackService } from '@/features/property-sources/server-repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handlers = createPropertySourceCallbackHttpHandlers({
  getService: getPropertySourceCallbackService,
  getConfig: readPropertySourceCallbackConfig,
})

export const POST = handlers.result
