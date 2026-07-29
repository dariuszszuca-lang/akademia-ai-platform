import { redirect } from 'next/navigation'
import OnboardingShell from '@/components/onboarding/OnboardingShell'
import { getServerUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getServerUserId())) redirect('/login')

  return <OnboardingShell>{children}</OnboardingShell>
}
