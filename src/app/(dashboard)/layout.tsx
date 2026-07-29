import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { getServerUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getServerUserId())) redirect('/login')

  return <DashboardShell>{children}</DashboardShell>
}
