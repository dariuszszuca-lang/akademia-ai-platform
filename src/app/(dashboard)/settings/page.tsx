import SettingsClient from '@/components/settings/SettingsClient'
import { getBillingMode } from '@/lib/billing/mode'

export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  return <SettingsClient billingMode={getBillingMode()} />
}
