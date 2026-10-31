import ToolHeader from '@/components/tools/ToolHeader'
import { getTool } from '@/lib/tools'
import RejestrClient from './RejestrClient'

export const metadata = { title: 'Rejestr cen transakcyjnych' }

export default function RejestrPage() {
  const tool = getTool('rejestr-cen')!
  return (
    <div className="animate-fade-in-up space-y-6">
      <ToolHeader tool={tool} mode="platform" />
      <RejestrClient />
    </div>
  )
}
