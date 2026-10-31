import ToolHeader from '@/components/tools/ToolHeader'
import ProtokolApp from '@/features/protokol/ProtokolApp'
import { getTool } from '@/lib/tools'

export const metadata = {
  title: 'Protokół zdawczo-odbiorczy mieszkania z telefonu',
  description:
    'Protokół wydania i zwrotu mieszkania: liczniki, zdjęcia pokoi, klucze, podpisy palcem i porównanie stanu przy zwrocie z rozliczeniem kaucji. Dane zostają na Twoim telefonie.',
}

export default function PublicProtokolPage() {
  const tool = getTool('protokol')!
  return (
    <div className="space-y-6 pt-6">
      <div className="no-print"><ToolHeader tool={tool} mode="public" /></div>
      <ProtokolApp mode="public" />
    </div>
  )
}
