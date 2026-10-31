import ToolHeader from '@/components/tools/ToolHeader'
import ProtokolApp from '@/features/protokol/ProtokolApp'
import { getTool } from '@/lib/tools'

export const metadata = { title: 'Protokół z telefonu' }

export default function ProtokolPage() {
  const tool = getTool('protokol')!
  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="no-print"><ToolHeader tool={tool} mode="platform" /></div>
      <ProtokolApp mode="platform" />
    </div>
  )
}
