import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SiteHeader } from '@/components/site/site-header'
import { requireStaff } from '@/lib/auth'
import { AdminNav } from './admin-nav'

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Loupe admin' }, robots: { index: false, follow: false } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireStaff()
  return (
    <>
      <SiteHeader />
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col lg:flex-row">
        <Suspense fallback={<div className="border-b bg-background lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r" />}>
          <AdminNav isAdmin={viewer.isAdmin} />
        </Suspense>
        <main id="main" className="min-w-0 flex-1 bg-surface/50 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </>
  )
}
