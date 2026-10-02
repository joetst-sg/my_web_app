import { redirect } from '@/lib/i18n/server'
import { AccountNav } from './account-nav'
import { requireViewer } from '@/lib/auth'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer('/account')
  if (!viewer.onboarded) return redirect('/onboarding')
  return (
    <div className="container-page flex flex-col gap-8 py-10 lg:flex-row lg:gap-12">
      <AccountNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
