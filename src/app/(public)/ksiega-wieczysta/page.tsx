import ToolHeader from '@/components/tools/ToolHeader'
import KsiegaApp from '@/features/ksiega/KsiegaApp'
import { getTool } from '@/lib/tools'

export const metadata = {
  title: 'Księga wieczysta po ludzku: co jest w księdze mieszkania',
  description:
    'Wklej treść księgi wieczystej i zobacz po ludzku: kto jest właścicielem, czy jest hipoteka, służebność, dożywocie albo egzekucja, i o co zapytać sprzedającego.',
}

export default function PublicKsiegaPage() {
  const tool = getTool('ksiega-wieczysta')!
  return (
    <div className="space-y-6 pt-6">
      <ToolHeader tool={tool} mode="public" />
      <KsiegaApp mode="public" />
    </div>
  )
}
