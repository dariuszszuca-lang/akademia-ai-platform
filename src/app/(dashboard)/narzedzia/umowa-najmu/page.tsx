import ToolHeader from '@/components/tools/ToolHeader'
import UmowaKreator from '@/features/umowa/UmowaKreator'
import { getTool } from '@/lib/tools'

export const metadata = { title: 'Umowa najmu okazjonalnego' }

export default function UmowaPage() {
  const tool = getTool('umowa-najmu')!
  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="no-print"><ToolHeader tool={tool} mode="platform" /></div>
      <UmowaKreator mode="platform" />
    </div>
  )
}
