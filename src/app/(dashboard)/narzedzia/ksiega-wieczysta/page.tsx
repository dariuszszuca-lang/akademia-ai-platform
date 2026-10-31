import ToolHeader from '@/components/tools/ToolHeader'
import KsiegaApp from '@/features/ksiega/KsiegaApp'
import { getTool } from '@/lib/tools'

export const metadata = { title: 'Księga wieczysta po ludzku' }

export default function KsiegaPage() {
  const tool = getTool('ksiega-wieczysta')!
  return (
    <div className="animate-fade-in-up space-y-6">
      <ToolHeader tool={tool} mode="platform" />
      <KsiegaApp mode="platform" />
    </div>
  )
}
