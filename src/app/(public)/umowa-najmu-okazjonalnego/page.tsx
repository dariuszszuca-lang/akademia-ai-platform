import ToolHeader from '@/components/tools/ToolHeader'
import UmowaKreator from '@/features/umowa/UmowaKreator'
import { getTool } from '@/lib/tools'

export const metadata = {
  title: 'Umowa najmu okazjonalnego: kreator ze wzorem',
  description:
    'Przygotuj umowę najmu okazjonalnego z listą załączników. Kreator pilnuje limitu 10 lat, kaucji do 6 czynszów i liczy termin zgłoszenia do urzędu skarbowego.',
}

export default function PublicUmowaPage() {
  const tool = getTool('umowa-najmu')!
  return (
    <div className="space-y-6 pt-6">
      <div className="no-print"><ToolHeader tool={tool} mode="public" /></div>
      <UmowaKreator mode="public" />
    </div>
  )
}
