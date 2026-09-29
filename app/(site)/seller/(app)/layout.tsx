import { redirect } from 'next/navigation'
import { requireViewer } from '@/lib/auth'
import { SellerNav } from './seller-nav'

export default async function SellerAppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer('/seller/dashboard')
  if (!viewer.isSeller && !viewer.isStaff) redirect('/seller')
  return (
    <div className="container-page flex flex-col gap-8 py-10 lg:flex-row lg:gap-12">
      <SellerNav />
      <div className="min-w-0 flex-1">
        {viewer.suspended && (
          <p role="alert" className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Your account is suspended. You can view your products but not edit or submit them. Contact support if you think this is a mistake.
          </p>
        )}
        {children}
      </div>
    </div>
  )
}
